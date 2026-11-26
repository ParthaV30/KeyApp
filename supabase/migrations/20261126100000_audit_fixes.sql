-- Audit fixes: atomic option saves, safer ordering, tighter grants.

-- 1. Save a product's options in one transaction. Existing options keep their live
--    stock (only new options take the supplied stock) so a stale edit form cannot
--    overwrite sales made in the meantime. Options not listed are deactivated.
create or replace function public.save_product_variants(p_product_id uuid, p_variants jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_row jsonb; v_names text[] := '{}'; v_index integer := 0; v_name text; v_price numeric; v_stock integer;
begin
  if not coalesce((select public.is_admin()), false) then raise exception 'Administrator access is required'; end if;
  if jsonb_typeof(p_variants) <> 'array' or jsonb_array_length(p_variants) not between 1 and 100 then
    raise exception 'A product needs between 1 and 100 options'; end if;
  perform 1 from public.products where id = p_product_id for update;
  if not found then raise exception 'Product not found'; end if;
  for v_row in select value from jsonb_array_elements(p_variants) loop
    v_name := trim(coalesce(v_row ->> 'name', ''));
    if v_name = '' or length(v_name) > 120 or coalesce(v_row ->> 'price', '') !~ '^[0-9]+(\.[0-9]{1,2})?$'
      or coalesce(v_row ->> 'stock_quantity', '0') !~ '^[0-9]{1,9}$' then raise exception 'Option "%" is invalid', v_name; end if;
    if v_name = any(v_names) then raise exception 'Option names must be unique'; end if;
    v_names := v_names || v_name;
    v_price := (v_row ->> 'price')::numeric; v_stock := coalesce(nullif(v_row ->> 'stock_quantity', ''), '0')::integer;
    insert into public.product_variants(product_id, name, price, stock_quantity, sku, is_active, sort_order)
    values (p_product_id, v_name, v_price, v_stock, nullif(trim(coalesce(v_row ->> 'sku', '')), ''), true, v_index)
    on conflict (product_id, name) do update
      set price = excluded.price, sku = excluded.sku, is_active = true, sort_order = excluded.sort_order;
    v_index := v_index + 1;
  end loop;
  update public.product_variants set is_active = false where product_id = p_product_id and not (name = any(v_names));
end;
$$;
revoke all on function public.save_product_variants(uuid, jsonb) from public, anon;
grant execute on function public.save_product_variants(uuid, jsonb) to authenticated;

-- 2. The legacy admin-only payment function ignores credit notes; the guarded
--    record_business_invoice_payment replaces it. create_counter_invoice still calls it internally.
revoke execute on function public.record_invoice_payment(uuid, numeric, text, text) from authenticated;

-- 3. TRUNCATE bypasses row-level security; the API never needs it.
revoke truncate, references, trigger on public.categories, public.products, public.product_variants,
  public.profiles, public.orders, public.order_items from authenticated;

-- 4. place_cod_order: lock products in a stable order (no cross-cart deadlocks),
--    require a recognised delivery state (needed for GST invoices), and cap open orders.
create or replace function public.place_cod_order(p_items jsonb, p_shipping jsonb, p_note text default '')
returns table(order_id uuid, order_number bigint, total numeric)
language plpgsql security definer set search_path = '' as $$
declare
  v_customer_id uuid := auth.uid(); v_order_id uuid; v_order_number bigint;
  v_subtotal numeric(12,2) := 0; v_line record; v_product public.products%rowtype;
  v_variant public.product_variants%rowtype; v_unit_price numeric(12,2); v_name text; v_sku text;
  v_quantity integer; v_stock integer; v_shipping_fee numeric(12,2) := 0; v_free_delivery_threshold numeric(12,2);
  v_gstin text := upper(trim(coalesce(p_shipping ->> 'gstin', '')));
begin
  if v_customer_id is null then raise exception 'Sign in is required to place an order'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 100 then
    raise exception 'Cart must contain between 1 and 100 items'; end if;
  if jsonb_typeof(p_shipping) <> 'object'
    or length(trim(coalesce(p_shipping ->> 'name', ''))) not between 2 and 120
    or length(regexp_replace(coalesce(p_shipping ->> 'phone', ''), '\D', '', 'g')) not between 10 and 15
    or length(trim(coalesce(p_shipping ->> 'address', ''))) not between 5 and 300
    or length(trim(coalesce(p_shipping ->> 'city', ''))) not between 2 and 100 then
    raise exception 'Shipping information is incomplete or invalid'; end if;
  if public.gst_state_code(p_shipping ->> 'state') is null then
    raise exception 'Enter a valid Indian state name for delivery'; end if;
  if v_gstin <> '' and v_gstin !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$' then
    raise exception 'Buyer GSTIN format is invalid'; end if;
  if (select count(*) from public.orders o where o.customer_id = v_customer_id and o.status = 'pending') >= 5 then
    raise exception 'You have too many pending orders. Please wait for them to be confirmed'; end if;
  insert into public.orders (customer_id, subtotal, shipping_fee, total, payment_method, payment_status,
    shipping_name, shipping_phone, shipping_address, shipping_city, shipping_state, shipping_postal_code, shipping_gstin, customer_note)
  values (v_customer_id, 0, v_shipping_fee, v_shipping_fee, 'cod', 'pay_on_delivery',
    trim(p_shipping ->> 'name'), trim(p_shipping ->> 'phone'), trim(p_shipping ->> 'address'),
    trim(p_shipping ->> 'city'), trim(coalesce(p_shipping ->> 'state', '')),
    trim(coalesce(p_shipping ->> 'postal_code', '')), v_gstin, left(trim(coalesce(p_note, '')), 1000))
  returning id, orders.order_number into v_order_id, v_order_number;
  for v_line in select value from jsonb_array_elements(p_items) order by value ->> 'product_id', value ->> 'variant_id' loop
    if (v_line.value ->> 'quantity') !~ '^[1-9][0-9]{0,3}$' then raise exception 'Invalid item quantity'; end if;
    v_quantity := (v_line.value ->> 'quantity')::integer;
    select * into v_product from public.products p where p.id = (v_line.value ->> 'product_id')::uuid and p.is_active for update;
    if not found then raise exception 'A product in your cart is no longer available'; end if;
    if v_product.has_variants then
      if nullif(v_line.value ->> 'variant_id', '') is null then raise exception 'Choose a product option before checkout'; end if;
      update public.product_variants pv set stock_quantity = stock_quantity - v_quantity
      where pv.id = (v_line.value ->> 'variant_id')::uuid and pv.product_id = v_product.id and pv.is_active and pv.stock_quantity >= v_quantity
      returning pv.* into v_variant;
      if not found then raise exception 'A selected option is out of stock'; end if;
      v_unit_price := v_variant.price; v_name := v_product.name; v_sku := coalesce(v_variant.sku, v_product.sku);
    else
      if nullif(v_line.value ->> 'variant_id', '') is not null then raise exception 'Invalid option for product'; end if;
      update public.products p set stock_quantity = stock_quantity - v_quantity where p.id = v_product.id and p.stock_quantity >= v_quantity
      returning p.stock_quantity into v_stock;
      if not found then raise exception 'A product is out of stock'; end if;
      v_unit_price := v_product.price; v_name := v_product.name; v_sku := v_product.sku;
    end if;
    v_subtotal := v_subtotal + v_unit_price * v_quantity;
    insert into public.order_items(order_id, product_id, variant_id, product_name, variant_name, sku, unit_price, quantity)
    values (v_order_id, v_product.id, case when v_product.has_variants then v_variant.id else null end,
      v_name, case when v_product.has_variants then v_variant.name else '' end, v_sku, v_unit_price, v_quantity);
    v_variant := null;
  end loop;
  select s.default_shipping_fee, s.free_delivery_threshold into v_shipping_fee, v_free_delivery_threshold from public.store_settings s where s.id = true;
  if v_free_delivery_threshold is not null and v_subtotal >= v_free_delivery_threshold then v_shipping_fee := 0; end if;
  v_shipping_fee := coalesce(v_shipping_fee, 0);
  update public.orders o set subtotal = v_subtotal, shipping_fee = v_shipping_fee, total = v_subtotal + v_shipping_fee where o.id = v_order_id;
  return query select v_order_id, v_order_number, v_subtotal + v_shipping_fee;
end; $$;
revoke all on function public.place_cod_order(jsonb, jsonb, text) from public, anon;
grant execute on function public.place_cod_order(jsonb, jsonb, text) to authenticated;
