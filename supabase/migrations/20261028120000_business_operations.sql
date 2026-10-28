-- Additive business operations foundation: suppliers, purchasing, inventory
-- ledger, expenses, scoped staff access and a privacy-conscious audit log.

alter table public.products add column if not exists reorder_level integer not null default 5 check (reorder_level >= 0);
alter table public.product_variants add column if not exists reorder_level integer not null default 5 check (reorder_level >= 0);

create table if not exists public.business_team_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  access_role text not null check (access_role in ('manager', 'inventory', 'billing', 'sales', 'viewer')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.business_team_members enable row level security;
create policy "Admins manage business team" on public.business_team_members for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
grant select, insert, update, delete on public.business_team_members to authenticated;
revoke all on public.business_team_members from anon, public;

create or replace function public.has_business_permission(p_permission text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_role text;
begin
  if auth.uid() is null then return false; end if;
  if (select public.is_admin()) then return true; end if;
  select access_role into v_role from public.business_team_members where user_id = auth.uid();
  return case v_role
    when 'manager' then p_permission in ('inventory', 'purchasing', 'billing', 'sales', 'reports', 'audit')
    when 'inventory' then p_permission in ('inventory', 'purchasing', 'reports')
    when 'billing' then p_permission in ('billing', 'reports')
    when 'sales' then p_permission in ('sales', 'billing', 'reports')
    when 'viewer' then p_permission in ('reports')
    else false end;
end;
$$;
revoke all on function public.has_business_permission(text) from public, anon;
grant execute on function public.has_business_permission(text) to authenticated;

create or replace function public.get_business_permissions()
returns text[] language sql stable security definer set search_path = '' as $$
  select array_remove(array[
    case when public.has_business_permission('inventory') then 'inventory' end,
    case when public.has_business_permission('purchasing') then 'purchasing' end,
    case when public.has_business_permission('billing') then 'billing' end,
    case when public.has_business_permission('sales') then 'sales' end,
    case when public.has_business_permission('reports') then 'reports' end,
    case when public.has_business_permission('audit') then 'audit' end
  ], null)
$$;
revoke all on function public.get_business_permissions() from public, anon;
grant execute on function public.get_business_permissions() to authenticated;

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 160),
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  city text not null default '',
  state text not null default '',
  postal_code text not null default '',
  gstin text not null default '',
  notes text not null default '',
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists suppliers_gstin_unique_idx on public.suppliers(gstin) where gstin <> '';
create index if not exists suppliers_name_idx on public.suppliers(name);
alter table public.suppliers enable row level security;
create policy "Business team can read suppliers" on public.suppliers for select to authenticated
  using ((select public.has_business_permission('purchasing')));
create policy "Business team can manage suppliers" on public.suppliers for all to authenticated
  using ((select public.has_business_permission('purchasing'))) with check ((select public.has_business_permission('purchasing')));
grant select, insert, update, delete on public.suppliers to authenticated;
revoke all on public.suppliers from anon, public;

create sequence if not exists public.purchase_order_sequence;
create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  status text not null default 'ordered' check (status in ('ordered', 'partially_received', 'received', 'cancelled')),
  ordered_at date not null default current_date,
  expected_at date,
  notes text not null default '',
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  tax_total numeric(12,2) not null default 0 check (tax_total >= 0),
  total numeric(12,2) not null default 0 check (total >= 0),
  paid_total numeric(12,2) not null default 0 check (paid_total >= 0 and paid_total <= total),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'part_paid', 'paid')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  variant_id uuid references public.product_variants(id) on delete restrict,
  product_name text not null,
  variant_name text not null default '',
  sku text not null default '',
  quantity_ordered integer not null check (quantity_ordered > 0),
  quantity_received integer not null default 0 check (quantity_received >= 0 and quantity_received <= quantity_ordered),
  unit_cost numeric(12,2) not null check (unit_cost >= 0),
  hsn_sac text not null default '',
  gst_rate numeric(5,2) not null default 0 check (gst_rate between 0 and 100),
  created_at timestamptz not null default now()
);
create index if not exists purchase_orders_supplier_date_idx on public.purchase_orders(supplier_id, ordered_at desc);
create index if not exists purchase_orders_status_date_idx on public.purchase_orders(status, ordered_at desc);
create index if not exists purchase_order_items_order_idx on public.purchase_order_items(purchase_order_id);
create table if not exists public.purchase_payments (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('cash', 'upi', 'bank_transfer', 'card', 'cheque', 'other')),
  reference text not null default '',
  paid_at timestamptz not null default now(),
  paid_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists purchase_payments_order_idx on public.purchase_payments(purchase_order_id, paid_at desc);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_name text not null,
  variant_name text not null default '',
  movement_type text not null check (movement_type in ('opening', 'purchase', 'sale', 'return', 'adjustment', 'damage', 'order_release')),
  quantity_change integer not null check (quantity_change <> 0),
  quantity_before integer not null check (quantity_before >= 0),
  quantity_after integer not null check (quantity_after >= 0),
  reason text not null default '',
  reference_type text not null default '',
  reference_id uuid,
  unit_cost numeric(12,2) check (unit_cost is null or unit_cost >= 0),
  performed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (quantity_after = quantity_before + quantity_change)
);
create index if not exists inventory_movements_product_date_idx on public.inventory_movements(product_id, created_at desc);
create index if not exists inventory_movements_variant_date_idx on public.inventory_movements(variant_id, created_at desc);
create index if not exists inventory_movements_reference_idx on public.inventory_movements(reference_type, reference_id);

create table if not exists public.business_expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null default current_date,
  category text not null check (length(trim(category)) between 2 and 80),
  description text not null default '',
  amount numeric(12,2) not null check (amount > 0),
  gst_amount numeric(12,2) not null default 0 check (gst_amount >= 0 and gst_amount <= amount),
  supplier_id uuid references public.suppliers(id) on delete set null,
  payment_method text not null check (payment_method in ('cash', 'upi', 'bank_transfer', 'card', 'cheque', 'other')),
  reference text not null default '',
  notes text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists business_expenses_date_idx on public.business_expenses(expense_date desc);
create index if not exists business_expenses_category_date_idx on public.business_expenses(category, expense_date desc);

create table if not exists public.business_audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  table_name text not null,
  record_id text not null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  changed_columns text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists business_audit_created_idx on public.business_audit_events(created_at desc);
create index if not exists business_audit_table_record_idx on public.business_audit_events(table_name, record_id, created_at desc);

do $$ declare t text; begin
  foreach t in array array['purchase_orders','purchase_order_items','purchase_payments','inventory_movements','business_expenses','business_audit_events'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

create policy "Purchasing team can read purchase orders" on public.purchase_orders for select to authenticated
  using ((select public.has_business_permission('purchasing')));
create policy "Purchasing team can read purchase lines" on public.purchase_order_items for select to authenticated
  using (exists (select 1 from public.purchase_orders po where po.id = purchase_order_id and (select public.has_business_permission('purchasing'))));
create policy "Purchasing team can read purchase payments" on public.purchase_payments for select to authenticated
  using ((select public.has_business_permission('purchasing')));
create policy "Inventory team can read stock movements" on public.inventory_movements for select to authenticated
  using ((select public.has_business_permission('inventory')));
create policy "Billing team can read expenses" on public.business_expenses for select to authenticated
  using ((select public.has_business_permission('billing')));
create policy "Billing team can create expenses" on public.business_expenses for insert to authenticated
  with check ((select public.has_business_permission('billing')));
create policy "Billing team can read business audit" on public.business_audit_events for select to authenticated
  using ((select public.has_business_permission('audit')));
grant select on public.purchase_orders, public.purchase_order_items to authenticated;
grant select on public.purchase_payments, public.inventory_movements, public.business_audit_events to authenticated;
grant select, insert on public.business_expenses to authenticated;
revoke all on public.purchase_orders, public.purchase_order_items, public.purchase_payments,
  public.inventory_movements, public.business_expenses, public.business_audit_events from anon, public;
revoke insert, update, delete on public.purchase_orders, public.purchase_order_items, public.purchase_payments,
  public.inventory_movements, public.business_expenses from authenticated;
revoke all on sequence public.purchase_order_sequence from public, anon, authenticated;

create or replace function public.audit_business_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_old jsonb; v_new jsonb; v_id text; v_columns text[];
begin
  if tg_op = 'INSERT' then v_new := to_jsonb(new); v_id := coalesce(v_new ->> 'id', v_new ->> 'user_id', 'unknown'); v_columns := array(select jsonb_object_keys(v_new));
  elsif tg_op = 'DELETE' then v_old := to_jsonb(old); v_id := coalesce(v_old ->> 'id', v_old ->> 'user_id', 'unknown'); v_columns := array(select jsonb_object_keys(v_old));
  else
    v_old := to_jsonb(old); v_new := to_jsonb(new); v_id := coalesce(v_new ->> 'id', v_new ->> 'user_id', 'unknown');
    select coalesce(array_agg(n.key order by n.key), '{}') into v_columns
    from jsonb_each(v_new) n where v_old -> n.key is distinct from n.value;
  end if;
  insert into public.business_audit_events(actor_id, table_name, record_id, action, changed_columns)
  values (auth.uid(), tg_table_name, v_id, tg_op, coalesce(v_columns, '{}'));
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.audit_business_change() from public, anon, authenticated;

create or replace function public.capture_stock_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_before integer; v_after integer; v_delta integer; v_type text; v_reason text;
begin
  if current_setting('app.inventory.skip_stock_trigger', true) = 'yes' then return new; end if;
  if tg_op = 'INSERT' then v_before := 0; v_after := new.stock_quantity;
  else v_before := old.stock_quantity; v_after := new.stock_quantity; end if;
  v_delta := v_after - v_before;
  if v_delta = 0 then return new; end if;
  v_type := coalesce(nullif(current_setting('app.inventory.movement_type', true), ''), case when tg_op = 'INSERT' then 'opening' else 'adjustment' end);
  v_reason := left(coalesce(nullif(current_setting('app.inventory.reason', true), ''), 'Stock quantity updated'), 240);
  insert into public.inventory_movements(product_id, product_name, movement_type, quantity_change, quantity_before, quantity_after, reason, performed_by)
  values (new.id, new.name, v_type, v_delta, greatest(v_before,0), greatest(v_after,0), v_reason, auth.uid());
  return new;
end;
$$;
revoke all on function public.capture_stock_change() from public, anon, authenticated;

drop trigger if exists products_capture_stock_change on public.products;
create trigger products_capture_stock_change after insert or update of stock_quantity on public.products
for each row execute function public.capture_stock_change();

create or replace function public.capture_variant_stock_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_before integer; v_after integer; v_delta integer; v_type text; v_reason text; v_product_name text;
begin
  if current_setting('app.inventory.skip_stock_trigger', true) = 'yes' then return new; end if;
  if tg_op = 'INSERT' then v_before := 0; v_after := new.stock_quantity;
  else v_before := old.stock_quantity; v_after := new.stock_quantity; end if;
  v_delta := v_after - v_before;
  if v_delta = 0 then return new; end if;
  select name into v_product_name from public.products where id = new.product_id;
  v_type := coalesce(nullif(current_setting('app.inventory.movement_type', true), ''), case when tg_op = 'INSERT' then 'opening' else 'adjustment' end);
  v_reason := left(coalesce(nullif(current_setting('app.inventory.reason', true), ''), 'Variant stock quantity updated'), 240);
  insert into public.inventory_movements(product_id, variant_id, product_name, variant_name, movement_type, quantity_change, quantity_before, quantity_after, reason, performed_by)
  values (new.product_id, new.id, coalesce(v_product_name,''), new.name, v_type, v_delta, greatest(v_before,0), greatest(v_after,0), v_reason, auth.uid());
  return new;
end;
$$;
revoke all on function public.capture_variant_stock_change() from public, anon, authenticated;
drop trigger if exists product_variants_capture_stock_change on public.product_variants;
create trigger product_variants_capture_stock_change after insert or update of stock_quantity on public.product_variants
for each row execute function public.capture_variant_stock_change();

-- Establish an opening-balance event for stock already present at deployment.
insert into public.inventory_movements(product_id, product_name, movement_type, quantity_change, quantity_before, quantity_after, reason)
select id, name, 'opening', stock_quantity, 0, stock_quantity, 'Opening balance at inventory ledger launch'
from public.products where stock_quantity > 0
on conflict do nothing;
insert into public.inventory_movements(product_id, variant_id, product_name, variant_name, movement_type, quantity_change, quantity_before, quantity_after, reason)
select p.id, v.id, p.name, v.name, 'opening', v.stock_quantity, 0, v.stock_quantity, 'Opening balance at inventory ledger launch'
from public.product_variants v join public.products p on p.id = v.product_id where v.stock_quantity > 0
on conflict do nothing;

do $$ declare t text; begin
  foreach t in array array['products','product_variants','orders','billing_settings','billing_invoices','billing_invoice_payments','suppliers','purchase_orders','purchase_order_items','purchase_payments','business_expenses','business_team_members'] loop
    execute format('drop trigger if exists business_audit_change on public.%I', t);
    execute format('create trigger business_audit_change after insert or update or delete on public.%I for each row execute function public.audit_business_change()', t);
  end loop;
end $$;

create or replace function public.create_purchase_order(
  p_supplier_id uuid, p_items jsonb, p_expected_at date default null, p_notes text default ''
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_order_id uuid; v_seq bigint; v_item jsonb; v_product public.products%rowtype; v_variant public.product_variants%rowtype;
  v_product_id uuid; v_variant_id uuid; v_quantity integer; v_cost numeric(12,2); v_gst numeric(5,2); v_subtotal numeric(12,2) := 0; v_tax numeric(12,2) := 0;
begin
  if not public.has_business_permission('purchasing') then raise exception 'Purchasing access is required'; end if;
  if not exists(select 1 from public.suppliers where id = p_supplier_id and is_active) then raise exception 'Choose an active supplier'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 100 then raise exception 'A purchase order requires 1 to 100 item lines'; end if;
  v_seq := nextval('public.purchase_order_sequence');
  insert into public.purchase_orders(order_code, supplier_id, expected_at, notes, created_by)
  values ('GRP-' || to_char(current_date,'YYYY') || '-' || lpad(v_seq::text, 6, '0'), p_supplier_id, p_expected_at, left(trim(coalesce(p_notes,'')), 1000), auth.uid())
  returning id into v_order_id;
  for v_item in select value from jsonb_array_elements(p_items) loop
    if coalesce(v_item->>'quantity','') !~ '^[1-9][0-9]{0,4}$' or coalesce(v_item->>'unit_cost','') !~ '^[0-9]+(\.[0-9]{1,2})?$' then raise exception 'Purchase quantity or unit cost is invalid'; end if;
    v_product_id := (v_item->>'product_id')::uuid;
    v_variant_id := nullif(v_item->>'variant_id','')::uuid;
    v_quantity := (v_item->>'quantity')::integer;
    v_cost := (v_item->>'unit_cost')::numeric;
    v_gst := coalesce(nullif(v_item->>'gst_rate','')::numeric,0);
    if v_cost < 0 or v_gst < 0 or v_gst > 100 then raise exception 'Purchase price or GST rate is invalid'; end if;
    select * into v_product from public.products where id = v_product_id for update;
    if not found then raise exception 'A selected product no longer exists'; end if;
    if v_product.has_variants then
      if v_variant_id is null then raise exception 'Choose a variant for each variant product'; end if;
      select * into v_variant from public.product_variants where id = v_variant_id and product_id = v_product_id for update;
      if not found then raise exception 'A selected product variant no longer exists'; end if;
    elsif v_variant_id is not null then raise exception 'The selected product does not have variants'; end if;
    insert into public.purchase_order_items(purchase_order_id, product_id, variant_id, product_name, variant_name, sku, quantity_ordered, unit_cost, hsn_sac, gst_rate)
    values (v_order_id, v_product_id, v_variant_id, v_product.name, case when v_variant_id is null then '' else v_variant.name end,
      case when v_variant_id is null then coalesce(v_product.sku,'') else coalesce(v_variant.sku, v_product.sku, '') end,
      v_quantity, v_cost, coalesce(v_product.hsn_sac,''), v_gst);
    v_subtotal := v_subtotal + (v_quantity * v_cost);
    v_tax := v_tax + round(v_quantity * v_cost * v_gst / 100, 2);
    v_variant := null;
  end loop;
  update public.purchase_orders set subtotal = v_subtotal, tax_total = v_tax, total = v_subtotal + v_tax where id = v_order_id;
  return v_order_id;
end;
$$;

create or replace function public.receive_purchase_order(p_order_id uuid, p_items jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare v_order public.purchase_orders%rowtype; v_line public.purchase_order_items%rowtype; v_item jsonb; v_qty integer; v_before integer; v_after integer; v_status text;
begin
  if not public.has_business_permission('purchasing') then raise exception 'Purchasing access is required'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Select at least one item quantity to receive'; end if;
  select * into v_order from public.purchase_orders where id = p_order_id for update;
  if not found then raise exception 'Purchase order not found'; end if;
  if v_order.status in ('received','cancelled') then raise exception 'This purchase order cannot receive more stock'; end if;
  perform set_config('app.inventory.skip_stock_trigger','yes',true);
  for v_item in select value from jsonb_array_elements(p_items) loop
    if coalesce(v_item->>'quantity','') !~ '^[1-9][0-9]{0,4}$' then raise exception 'Enter a valid receive quantity'; end if;
    v_qty := (v_item->>'quantity')::integer;
    select * into v_line from public.purchase_order_items where id = (v_item->>'line_id')::uuid and purchase_order_id = p_order_id for update;
    if not found or v_line.quantity_received + v_qty > v_line.quantity_ordered then raise exception 'Received quantity exceeds the remaining quantity'; end if;
    if v_line.variant_id is not null then
      select stock_quantity into v_before from public.product_variants where id = v_line.variant_id and product_id = v_line.product_id for update;
      if not found then raise exception 'A product variant no longer exists'; end if;
      v_after := v_before + v_qty;
      perform set_config('app.inventory.skip_stock_trigger','yes',true);
      update public.product_variants set stock_quantity = v_after where id = v_line.variant_id;
    else
      select stock_quantity into v_before from public.products where id = v_line.product_id for update;
      if not found then raise exception 'A product no longer exists'; end if;
      v_after := v_before + v_qty;
      update public.products set stock_quantity = v_after where id = v_line.product_id;
    end if;
    insert into public.inventory_movements(product_id, variant_id, product_name, variant_name, movement_type, quantity_change, quantity_before, quantity_after, reason, reference_type, reference_id, unit_cost, performed_by)
    values (v_line.product_id, v_line.variant_id, v_line.product_name, v_line.variant_name, 'purchase', v_qty, v_before, v_after,
      'Purchase goods received', 'purchase_order', p_order_id, v_line.unit_cost, auth.uid());
    update public.purchase_order_items set quantity_received = quantity_received + v_qty where id = v_line.id;
  end loop;
  if not exists(select 1 from public.purchase_order_items where purchase_order_id = p_order_id and quantity_received < quantity_ordered) then v_status := 'received';
  else v_status := 'partially_received'; end if;
  update public.purchase_orders set status = v_status where id = p_order_id;
  return v_status;
end;
$$;

create or replace function public.record_purchase_payment(p_order_id uuid, p_amount numeric, p_method text, p_reference text default '')
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_order public.purchase_orders%rowtype; v_payment_id uuid;
begin
  if not public.has_business_permission('purchasing') then raise exception 'Purchasing access is required'; end if;
  if p_amount is null or p_amount <= 0 or p_method not in ('cash','upi','bank_transfer','card','cheque','other') then raise exception 'Enter a valid payment amount and method'; end if;
  select * into v_order from public.purchase_orders where id = p_order_id for update;
  if not found then raise exception 'Purchase order not found'; end if;
  if round(p_amount,2) > v_order.total - v_order.paid_total then raise exception 'Payment exceeds the supplier balance'; end if;
  insert into public.purchase_payments(purchase_order_id, amount, payment_method, reference, paid_by)
  values (p_order_id, round(p_amount,2), p_method, left(trim(coalesce(p_reference,'')),120), auth.uid()) returning id into v_payment_id;
  update public.purchase_orders set paid_total = paid_total + round(p_amount,2),
    payment_status = case when paid_total + round(p_amount,2) >= total then 'paid' else 'part_paid' end where id = p_order_id;
  return v_payment_id;
end;
$$;

create or replace function public.adjust_inventory(p_product_id uuid, p_variant_id uuid, p_delta integer, p_reason text, p_movement_type text default 'adjustment')
returns integer language plpgsql security definer set search_path = '' as $$
declare v_before integer; v_after integer;
begin
  if not public.has_business_permission('inventory') then raise exception 'Inventory access is required'; end if;
  if p_delta is null or p_delta = 0 or length(trim(coalesce(p_reason,''))) not between 3 and 240 then raise exception 'Enter a non-zero quantity and a reason'; end if;
  if p_movement_type is null or p_movement_type not in ('adjustment','damage','return') then raise exception 'Choose a valid stock movement type'; end if;
  if (p_movement_type = 'damage' and p_delta > 0) or (p_movement_type = 'return' and p_delta < 0) then raise exception 'The stock change does not match the movement type'; end if;
  perform set_config('app.inventory.movement_type', p_movement_type, true);
  perform set_config('app.inventory.reason', left(trim(p_reason),240), true);
  if p_variant_id is not null then
    select stock_quantity into v_before from public.product_variants where id = p_variant_id and product_id = p_product_id for update;
    if not found then raise exception 'Product variant not found'; end if;
    v_after := v_before + p_delta;
    if v_after < 0 then raise exception 'Stock cannot be reduced below zero'; end if;
    update public.product_variants set stock_quantity = v_after where id = p_variant_id;
  else
    select stock_quantity into v_before from public.products where id = p_product_id for update;
    if not found then raise exception 'Product not found'; end if;
    v_after := v_before + p_delta;
    if v_after < 0 then raise exception 'Stock cannot be reduced below zero'; end if;
    update public.products set stock_quantity = v_after where id = p_product_id;
  end if;
  return v_after;
end;
$$;

create or replace function public.set_inventory_reorder_level(p_product_id uuid, p_variant_id uuid, p_level integer)
returns integer language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_business_permission('inventory') then raise exception 'Inventory access is required'; end if;
  if p_level is null or p_level < 0 or p_level > 100000 then raise exception 'Reorder level must be between 0 and 100000'; end if;
  if p_variant_id is not null then
    update public.product_variants set reorder_level = p_level where id = p_variant_id and product_id = p_product_id;
    if not found then raise exception 'Product variant not found'; end if;
  else
    update public.products set reorder_level = p_level where id = p_product_id;
    if not found then raise exception 'Product not found'; end if;
  end if;
  return p_level;
end;
$$;

create or replace function public.record_business_invoice_payment(
  p_invoice_id uuid, p_amount numeric, p_method text, p_reference text default ''
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_invoice public.billing_invoices%rowtype; v_payment_id uuid;
begin
  if not public.has_business_permission('billing') then raise exception 'Billing access is required'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Payment amount must be greater than zero'; end if;
  if p_method not in ('cash','upi','bank_transfer','card','cheque','other') then raise exception 'Choose a valid payment method'; end if;
  select * into v_invoice from public.billing_invoices where id = p_invoice_id for update;
  if not found then raise exception 'Invoice not found'; end if;
  if v_invoice.status <> 'issued' then raise exception 'Payments can only be recorded on issued invoices'; end if;
  if round(p_amount,2) > v_invoice.total - v_invoice.paid_total then raise exception 'Payment exceeds the outstanding balance'; end if;
  insert into public.billing_invoice_payments(invoice_id,amount,payment_method,reference,received_by)
  values (p_invoice_id,round(p_amount,2),p_method,left(trim(coalesce(p_reference,'')),120),auth.uid()) returning id into v_payment_id;
  update public.billing_invoices set paid_total = paid_total + round(p_amount,2),
    payment_status = case when paid_total + round(p_amount,2) >= total then 'paid' else 'part_paid' end where id = p_invoice_id;
  if v_invoice.order_id is not null and v_invoice.paid_total + round(p_amount,2) >= v_invoice.total then
    update public.orders set payment_status = 'paid' where id = v_invoice.order_id;
  end if;
  return v_payment_id;
end;
$$;

create or replace function public.get_business_report_summary()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if not public.has_business_permission('reports') then raise exception 'Reports access is required'; end if;
  select jsonb_build_object(
    'monthly_sales', coalesce((select sum(total) from public.billing_invoices where status = 'issued' and issue_date >= date_trunc('month',current_date)::date),0),
    'monthly_collections', coalesce((select sum(amount) from public.billing_invoice_payments where paid_at >= date_trunc('month',current_date)),0),
    'receivables', coalesce((select sum(greatest(total-paid_total,0)) from public.billing_invoices where status = 'issued'),0),
    'overdue_receivables', coalesce((select sum(greatest(total-paid_total,0)) from public.billing_invoices where status = 'issued' and due_date < current_date),0),
    'monthly_output_gst', coalesce((select sum(cgst_total+sgst_total+igst_total) from public.billing_invoices where status = 'issued' and issue_date >= date_trunc('month',current_date)::date),0),
    'monthly_expenses', coalesce((select sum(amount) from public.business_expenses where expense_date >= date_trunc('month',current_date)::date),0),
    'monthly_purchases', coalesce((select sum(total) from public.purchase_orders where ordered_at >= date_trunc('month',current_date)::date and status <> 'cancelled'),0),
    'monthly_input_gst', coalesce((select sum(tax_total) from public.purchase_orders where ordered_at >= date_trunc('month',current_date)::date and status <> 'cancelled'),0),
    'low_stock_items', (select count(*) from public.products where is_active and not has_variants and stock_quantity <= reorder_level)
      + (select count(*) from public.product_variants where is_active and stock_quantity <= reorder_level)
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function public.create_purchase_order(uuid,jsonb,date,text), public.receive_purchase_order(uuid,jsonb),
  public.record_purchase_payment(uuid,numeric,text,text), public.adjust_inventory(uuid,uuid,integer,text,text), public.set_inventory_reorder_level(uuid,uuid,integer),
  public.record_business_invoice_payment(uuid,numeric,text,text), public.get_business_report_summary() from public, anon;
grant execute on function public.create_purchase_order(uuid,jsonb,date,text), public.receive_purchase_order(uuid,jsonb),
  public.record_purchase_payment(uuid,numeric,text,text), public.adjust_inventory(uuid,uuid,integer,text,text), public.set_inventory_reorder_level(uuid,uuid,integer),
  public.record_business_invoice_payment(uuid,numeric,text,text), public.get_business_report_summary() to authenticated;

-- Staff-specific read access for operational catalog views; existing product
-- mutation policies remain admin-only.
drop policy if exists "Inventory team can read all products" on public.products;
create policy "Inventory team can read all products" on public.products for select to authenticated
  using ((select public.has_business_permission('inventory')));
drop policy if exists "Inventory team can read all variants" on public.product_variants;
create policy "Inventory team can read all variants" on public.product_variants for select to authenticated
  using ((select public.has_business_permission('inventory')));

-- Billing staff can read invoices and record payments through the guarded RPC.
drop policy if exists "Admins can read billing invoices" on public.billing_invoices;
create policy "Billing team can read billing invoices" on public.billing_invoices for select to authenticated
  using ((select public.has_business_permission('billing')));
drop policy if exists "Admins can read billing invoice items" on public.billing_invoice_items;
create policy "Billing team can read billing invoice items" on public.billing_invoice_items for select to authenticated
  using (exists(select 1 from public.billing_invoices i where i.id = invoice_id and (select public.has_business_permission('billing'))));
drop policy if exists "Admins can read billing invoice payments" on public.billing_invoice_payments;
create policy "Billing team can read billing invoice payments" on public.billing_invoice_payments for select to authenticated
  using (exists(select 1 from public.billing_invoices i where i.id = invoice_id and (select public.has_business_permission('billing'))));

drop policy if exists "Sales team can read all orders" on public.orders;
create policy "Sales team can read all orders" on public.orders for select to authenticated
  using ((select public.has_business_permission('sales')));
drop policy if exists "Sales team can update order status" on public.orders;
create policy "Sales team can update order status" on public.orders for update to authenticated
  using ((select public.has_business_permission('sales'))) with check ((select public.has_business_permission('sales')));

drop policy if exists "Business team can read billing settings" on public.billing_settings;
create policy "Business team can read billing settings" on public.billing_settings for select to authenticated
  using ((select public.has_business_permission('billing')));

