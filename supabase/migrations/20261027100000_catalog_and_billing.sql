-- Seed the complete category catalog shown in src/data/products.ts.
-- Existing category activation choices are preserved when this migration is re-run.
insert into public.categories (name, slug, description, sort_order)
values
  ('Alarm System', 'alarm-system-admin', 'Vehicle alarm systems', 1),
  ('Car Remote Cover', 'car-remote-cover-admin', 'Protective remote covers', 2),
  ('Car Accessories', 'car-accessories-admin', 'Automotive accessories', 3),
  ('Remote Shell (Case)', 'remote-shell-case-1-admin', 'Flip and remote key cases', 4),
  ('Smart Shell (Case)', 'smart-shell-case-1-admin', 'Smart key replacement shells', 5),
  ('ID Key Shell', 'id-key-shell-1-admin', 'Transponder key shells', 6),
  ('Remotes', 'remotes-1-admin', 'Remote controls and fobs', 7),
  ('Smart Keys', 'smart-keys-admin', 'Smart key fobs', 8),
  ('PCB MB', 'pcb-mb-admin', 'Remote and key circuit boards', 9),
  ('Xhorse Remote', 'xhorse-remote-1-admin', 'Xhorse remotes', 10),
  ('Keydiy Remote', 'keydiy-remote-admin', 'Keydiy remotes', 11),
  ('CG & AIK Remotes', 'cg-aik-remotes-admin', 'CG and AIK remotes', 12),
  ('Keypad', 'keypad-admin', 'Keypads and buttons', 13),
  ('Blades', 'blades-1-admin', 'Automotive key blades', 14),
  ('ID Transponders', 'id-transponders-admin', 'Transponder chips', 15),
  ('Logo Stickers', 'logo-stickers-admin', 'Vehicle logo stickers', 16),
  ('Soldering Buttons', 'soldering-buttons-admin', 'Micro switches and buttons', 17),
  ('Batteries', 'batteries-1-admin', 'Key and remote batteries', 18),
  ('On Table Tool', 'on-table-tool-admin', 'Bench locksmith tools', 19),
  ('Immo & Lockset', 'immo-lockset-1-admin', 'Immobilizer and lock sets', 20),
  ('LCD Display Keys', 'lcd-display-keys-1-admin', 'Keys with LCD displays', 21),
  ('Programming Tool', 'programming-tool-1-admin', 'Key programming tools', 22),
  ('Auto Cut Machine', 'auto-cut-machine-admin', 'Automatic key cutting machines', 23),
  ('Manual Cut Machine', 'manual-cut-machine-admin', 'Manual key cutting machines', 24),
  ('2 Wheelers Keys', '2-wheelers-keys-admin', 'Two-wheeler keys', 25),
  ('Super Bike Keys', 'super-bike-keys-admin', 'Performance motorcycle keys', 26),
  ('EV Vehicle', 'ev-electric-vehicle-1-admin', 'Electric vehicle keys', 27),
  ('3 Wheelers', '3-wheelers-keys-1-admin', 'Three-wheeler vehicle keys', 28),
  ('4 Wheelers', '4-wheelers-keys-1-admin', 'Four-wheeler vehicle keys', 29),
  ('Commercial Vehicles', 'commercial-vehicles-admin', 'Commercial vehicle keys', 30),
  ('Tractor Keys', 'tractor-keys-admin', 'Tractor keys and blanks', 31),
  ('Domestic Keys', 'domestic-keys-1-admin', 'House and domestic keys', 32),
  ('Decoder Tool', 'decoder-tool-1-admin', 'Key decoding tools', 33),
  ('Bike Flip Keys', 'bike-flip-keys-admin', 'Motorcycle flip keys', 34),
  ('Fancy Keys', 'fancy-keys-admin', 'Decorative key blanks', 35),
  ('Display Unit', 'display-unit-1-admin', 'Product display units', 36),
  ('Cutters & Bit', 'cutters-bit-1-admin', 'Cutters and machine bits', 37),
  ('Part & Accessories', 'part-accessories-1-admin', 'Parts and accessories', 38),
  ('Hand Tools', 'hand-tools-1-admin', 'Hand tools for locksmiths', 39),
  ('Locks', 'locks-admin', 'Locks and lock hardware', 40),
  ('Keychains', 'keychains-admin', 'Keychains and rings', 41),
  ('Others', 'others-1-admin', 'More locksmith essentials', 42)
on conflict (name) do update set
  description = excluded.description,
  sort_order = excluded.sort_order;

alter table public.products
  add column if not exists hsn_sac text not null default '',
  add column if not exists gst_rate numeric(5,2) not null default 0
    check (gst_rate >= 0 and gst_rate <= 100);

-- Keep the buyer's optional GSTIN and the tax classification used when an
-- order was placed, so later catalog edits cannot rewrite historical invoices.
alter table public.orders add column if not exists shipping_gstin text not null default '';
alter table public.order_items
  add column if not exists hsn_sac text not null default '',
  add column if not exists gst_rate numeric(5,2) not null default 0 check (gst_rate >= 0 and gst_rate <= 100);
update public.order_items oi set hsn_sac = coalesce(p.hsn_sac, ''), gst_rate = coalesce(p.gst_rate, 0)
from public.products p where p.id = oi.product_id and oi.hsn_sac = '' and oi.gst_rate = 0;

create or replace function public.snapshot_order_item_tax()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select coalesce(p.hsn_sac, ''), coalesce(p.gst_rate, 0)
    into new.hsn_sac, new.gst_rate from public.products p where p.id = new.product_id;
  return new;
end;
$$;
drop trigger if exists order_items_snapshot_tax on public.order_items;
create trigger order_items_snapshot_tax before insert on public.order_items
for each row execute function public.snapshot_order_item_tax();

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
  if v_gstin <> '' and v_gstin !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$' then
    raise exception 'Buyer GSTIN format is invalid'; end if;
  insert into public.orders (customer_id, subtotal, shipping_fee, total, payment_method, payment_status,
    shipping_name, shipping_phone, shipping_address, shipping_city, shipping_state, shipping_postal_code, shipping_gstin, customer_note)
  values (v_customer_id, 0, v_shipping_fee, v_shipping_fee, 'cod', 'pay_on_delivery',
    trim(p_shipping ->> 'name'), trim(p_shipping ->> 'phone'), trim(p_shipping ->> 'address'),
    trim(p_shipping ->> 'city'), trim(coalesce(p_shipping ->> 'state', '')),
    trim(coalesce(p_shipping ->> 'postal_code', '')), v_gstin, left(trim(coalesce(p_note, '')), 1000))
  returning id, orders.order_number into v_order_id, v_order_number;
  for v_line in select value from jsonb_array_elements(p_items) loop
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

create or replace function public.gst_state_code(p_state text)
returns text language sql immutable parallel safe set search_path = '' as $$
  select case regexp_replace(upper(coalesce(p_state, '')), '[^A-Z0-9]', '', 'g')
    when '01' then '01' when 'JAMMUKASHMIR' then '01' when 'JK' then '01'
    when '02' then '02' when 'HIMACHALPRADESH' then '02' when 'HP' then '02'
    when '03' then '03' when 'PUNJAB' then '03' when 'PB' then '03'
    when '04' then '04' when 'CHANDIGARH' then '04' when 'CH' then '04'
    when '05' then '05' when 'UTTARAKHAND' then '05' when 'UK' then '05'
    when '06' then '06' when 'HARYANA' then '06' when 'HR' then '06'
    when '07' then '07' when 'DELHI' then '07' when 'DL' then '07'
    when '08' then '08' when 'RAJASTHAN' then '08' when 'RJ' then '08'
    when '09' then '09' when 'UTTARPRADESH' then '09' when 'UP' then '09'
    when '10' then '10' when 'BIHAR' then '10' when 'BR' then '10'
    when '11' then '11' when 'SIKKIM' then '11' when 'SK' then '11'
    when '12' then '12' when 'ARUNACHALPRADESH' then '12' when 'AR' then '12'
    when '13' then '13' when 'NAGALAND' then '13' when 'NL' then '13'
    when '14' then '14' when 'MANIPUR' then '14' when 'MN' then '14'
    when '15' then '15' when 'MIZORAM' then '15' when 'MZ' then '15'
    when '16' then '16' when 'TRIPURA' then '16' when 'TR' then '16'
    when '17' then '17' when 'MEGHALAYA' then '17' when 'ML' then '17'
    when '18' then '18' when 'ASSAM' then '18' when 'AS' then '18'
    when '19' then '19' when 'WESTBENGAL' then '19' when 'WB' then '19'
    when '20' then '20' when 'JHARKHAND' then '20' when 'JH' then '20'
    when '21' then '21' when 'ODISHA' then '21' when 'ORISSA' then '21' when 'OD' then '21'
    when '22' then '22' when 'CHHATTISGARH' then '22' when 'CG' then '22'
    when '23' then '23' when 'MADHYAPRADESH' then '23' when 'MP' then '23'
    when '24' then '24' when 'GUJARAT' then '24' when 'GJ' then '24'
    when '25' then '25' when 'DAMANANDDIU' then '25'
    when '26' then '26' when 'DADRAANDNAGARHAVELIANDDAMANANDDIU' then '26'
    when '27' then '27' when 'MAHARASHTRA' then '27' when 'MH' then '27'
    when '28' then '28'
    when '29' then '29' when 'KARNATAKA' then '29' when 'KA' then '29'
    when '30' then '30' when 'GOA' then '30' when 'GA' then '30'
    when '31' then '31' when 'LAKSHADWEEP' then '31' when 'LD' then '31'
    when '32' then '32' when 'KERALA' then '32' when 'KL' then '32'
    when '33' then '33' when 'TAMILNADU' then '33' when 'TN' then '33'
    when '34' then '34' when 'PUDUCHERRY' then '34' when 'PONDICHERRY' then '34' when 'PY' then '34'
    when '35' then '35' when 'ANDAMANANDNICOBARISLANDS' then '35' when 'AN' then '35'
    when '36' then '36' when 'TELANGANA' then '36' when 'TS' then '36' when 'TG' then '36'
    when '37' then '37' when 'ANDHRAPRADESH' then '37' when 'AP' then '37'
    when '38' then '38' when 'LADAKH' then '38'
    when '97' then '97' when 'OTHERCOUNTRY' then '97' when 'OTHERSTATE' then '97'
    else null end;
$$;

-- Billing identity is kept separate from the publicly readable storefront settings.
create table if not exists public.billing_settings (
  id boolean primary key default true check (id),
  business_name text not null default 'Giriraja',
  business_address text not null default '',
  business_city text not null default 'Bengaluru',
  business_state text not null default 'Karnataka',
  business_postal_code text not null default '',
  business_gstin text not null default '',
  gst_enabled boolean not null default false,
  shipping_gst_rate numeric(5,2) not null default 0 check (shipping_gst_rate >= 0 and shipping_gst_rate <= 100),
  invoice_prefix text not null default 'GR',
  updated_at timestamptz not null default now()
);
insert into public.billing_settings (id) values (true) on conflict (id) do nothing;
drop trigger if exists billing_settings_updated_at on public.billing_settings;
create trigger billing_settings_updated_at before update on public.billing_settings for each row execute function public.set_updated_at();
alter table public.billing_settings enable row level security;
create policy "Admins can read billing settings" on public.billing_settings for select to authenticated
  using ((select public.is_admin()));
create policy "Admins can insert billing settings" on public.billing_settings for insert to authenticated
  with check ((select public.is_admin()));
create policy "Admins can update billing settings" on public.billing_settings for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
grant select, insert, update on public.billing_settings to authenticated;
revoke all on public.billing_settings from anon, public;

create sequence if not exists public.billing_invoice_sequence;

create table if not exists public.billing_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_sequence bigint not null unique,
  invoice_code text not null unique,
  order_id uuid unique references public.orders(id) on delete restrict,
  status text not null default 'issued' check (status in ('issued', 'void')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'part_paid', 'paid')),
  issue_date date not null default current_date,
  due_date date,
  currency text not null default 'INR' check (currency = 'INR'),
  seller_name text not null,
  seller_address text not null default '',
  seller_city text not null default '',
  seller_state text not null default '',
  seller_postal_code text not null default '',
  seller_gstin text not null default '',
  buyer_name text not null,
  buyer_phone text not null default '',
  buyer_address text not null default '',
  buyer_city text not null default '',
  buyer_state text not null default '',
  buyer_postal_code text not null default '',
  buyer_gstin text not null default '',
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  cgst_total numeric(12,2) not null default 0 check (cgst_total >= 0),
  sgst_total numeric(12,2) not null default 0 check (sgst_total >= 0),
  igst_total numeric(12,2) not null default 0 check (igst_total >= 0),
  shipping_fee numeric(12,2) not null default 0 check (shipping_fee >= 0),
  total numeric(12,2) not null default 0 check (total >= 0),
  paid_total numeric(12,2) not null default 0 check (paid_total >= 0 and paid_total <= total),
  notes text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.billing_invoices(id) on delete restrict,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  variant_name text not null default '',
  sku text not null default '',
  hsn_sac text not null default '',
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  gst_rate numeric(5,2) not null default 0 check (gst_rate >= 0 and gst_rate <= 100),
  taxable_value numeric(12,2) not null check (taxable_value >= 0),
  cgst numeric(12,2) not null default 0 check (cgst >= 0),
  sgst numeric(12,2) not null default 0 check (sgst >= 0),
  igst numeric(12,2) not null default 0 check (igst >= 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.billing_invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.billing_invoices(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('cash', 'upi', 'bank_transfer', 'card', 'cheque', 'other')),
  reference text not null default '',
  paid_at timestamptz not null default now(),
  received_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists billing_invoices_issue_date_idx on public.billing_invoices(issue_date desc);
create index if not exists billing_invoices_payment_status_idx on public.billing_invoices(payment_status, issue_date desc);
create index if not exists billing_invoice_items_invoice_idx on public.billing_invoice_items(invoice_id);
create index if not exists billing_invoice_payments_invoice_idx on public.billing_invoice_payments(invoice_id, paid_at desc);

alter table public.billing_invoices enable row level security;
alter table public.billing_invoice_items enable row level security;
alter table public.billing_invoice_payments enable row level security;

drop policy if exists "Admins can read billing settings" on public.billing_settings;
create policy "Admins can read billing settings" on public.billing_settings for select to authenticated
  using ((select public.is_admin()));
drop policy if exists "Admins can insert billing settings" on public.billing_settings;
create policy "Admins can insert billing settings" on public.billing_settings for insert to authenticated
  with check ((select public.is_admin()));
drop policy if exists "Admins can update billing settings" on public.billing_settings;
create policy "Admins can update billing settings" on public.billing_settings for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "Admins can read billing invoices" on public.billing_invoices;
create policy "Admins can read billing invoices" on public.billing_invoices
  for select to authenticated using ((select public.is_admin()));
drop policy if exists "Admins can read billing invoice items" on public.billing_invoice_items;
create policy "Admins can read billing invoice items" on public.billing_invoice_items
  for select to authenticated using ((select public.is_admin()));
drop policy if exists "Admins can read billing invoice payments" on public.billing_invoice_payments;
create policy "Admins can read billing invoice payments" on public.billing_invoice_payments
  for select to authenticated using ((select public.is_admin()));

grant select on public.billing_invoices, public.billing_invoice_items, public.billing_invoice_payments to authenticated;
revoke all on public.billing_invoices, public.billing_invoice_items, public.billing_invoice_payments from anon, public;

create or replace function public.issue_order_invoice(p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_settings public.billing_settings%rowtype;
  v_invoice public.billing_invoices%rowtype;
  v_line record;
  v_invoice_id uuid;
  v_sequence bigint;
  v_fy_start integer;
  v_fy text;
  v_invoice_code text;
  v_taxable numeric(12,2);
  v_gross numeric(12,2);
  v_rate numeric(5,2);
  v_tax numeric(12,2);
  v_cgst numeric(12,2);
  v_sgst numeric(12,2);
  v_igst numeric(12,2);
  v_subtotal numeric(12,2) := 0;
  v_cgst_total numeric(12,2) := 0;
  v_sgst_total numeric(12,2) := 0;
  v_igst_total numeric(12,2) := 0;
  v_total numeric(12,2) := 0;
  v_is_intra_state boolean;
  v_shipping_rate numeric(5,2);
  v_shipping_tax numeric(12,2);
  v_shipping_cgst numeric(12,2);
  v_shipping_sgst numeric(12,2);
  v_shipping_igst numeric(12,2);
  v_seller_state_code text;
  v_buyer_state_code text;
begin
  if not coalesce((select public.is_admin()), false) then
    raise exception 'Administrator access is required';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.status = 'cancelled' then raise exception 'Cancelled orders cannot be invoiced'; end if;

  select id into v_invoice_id from public.billing_invoices where order_id = p_order_id;
  if found then return v_invoice_id; end if;

  select * into v_settings from public.billing_settings where id = true;
  if coalesce(v_settings.gst_enabled, false) and nullif(trim(v_settings.business_gstin), '') is null then
    raise exception 'Enter the business GSTIN in Billing settings before enabling GST';
  end if;
  if coalesce(v_settings.gst_enabled, false) then
    if upper(trim(v_settings.business_gstin)) !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$' then
      raise exception 'Enter a valid 15-character seller GSTIN before issuing a GST invoice';
    end if;
    v_seller_state_code := public.gst_state_code(v_settings.business_state);
    v_buyer_state_code := public.gst_state_code(v_order.shipping_state);
    if v_seller_state_code is null or v_buyer_state_code is null then
      raise exception 'Enter valid seller and delivery state names or GST state codes before issuing a GST invoice';
    end if;
    if left(upper(trim(v_settings.business_gstin)), 2) <> v_seller_state_code then
      raise exception 'Seller GSTIN state code does not match the business state';
    end if;
    if nullif(trim(v_order.shipping_gstin), '') is not null
      and (upper(trim(v_order.shipping_gstin)) !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'
        or left(upper(trim(v_order.shipping_gstin)), 2) <> v_buyer_state_code) then
      raise exception 'Buyer GSTIN is invalid or its state code does not match the delivery state';
    end if;
  end if;
  v_is_intra_state := coalesce(v_seller_state_code = v_buyer_state_code, true);
  v_sequence := nextval('public.billing_invoice_sequence');
  v_fy_start := extract(year from current_date)::integer - case when extract(month from current_date) < 4 then 1 else 0 end;
  v_fy := v_fy_start::text || '-' || right((v_fy_start + 1)::text, 2);
  v_invoice_code := coalesce(nullif(trim(v_settings.invoice_prefix), ''), 'GR') || '/' || v_fy || '/' || lpad(v_sequence::text, 6, '0');

  insert into public.billing_invoices (
    invoice_sequence, invoice_code, order_id, issue_date,
    seller_name, seller_address, seller_city, seller_state, seller_postal_code, seller_gstin,
    buyer_name, buyer_phone, buyer_address, buyer_city, buyer_state, buyer_postal_code, buyer_gstin,
    shipping_fee, notes, created_by
  ) values (
    v_sequence, v_invoice_code, p_order_id, current_date,
    coalesce(nullif(v_settings.business_name, ''), 'Giriraja'), v_settings.business_address,
    v_settings.business_city, v_settings.business_state, v_settings.business_postal_code,
    case when v_settings.gst_enabled then v_settings.business_gstin else '' end,
    v_order.shipping_name, v_order.shipping_phone, v_order.shipping_address, v_order.shipping_city,
    v_order.shipping_state, v_order.shipping_postal_code, coalesce(v_order.shipping_gstin, ''),
    v_order.shipping_fee, v_order.customer_note, auth.uid()
  ) returning id into v_invoice_id;

  for v_line in
    select oi.product_id, oi.product_name, oi.variant_name, coalesce(oi.sku, '') as sku,
      oi.quantity, oi.unit_price, coalesce(oi.hsn_sac, '') as hsn_sac, coalesce(oi.gst_rate, 0) as gst_rate
    from public.order_items oi
    where oi.order_id = p_order_id order by oi.id
  loop
    v_gross := round(v_line.quantity * v_line.unit_price, 2);
    v_rate := case when v_settings.gst_enabled then v_line.gst_rate else 0 end;
    -- Order prices are GST-inclusive. The invoice must preserve the amount
    -- already presented to the customer at checkout.
    v_taxable := case when v_rate > 0 then round(v_gross / (1 + v_rate / 100), 2) else v_gross end;
    v_tax := v_gross - v_taxable;
    v_cgst := 0; v_sgst := 0; v_igst := 0;
    if v_is_intra_state then
      v_cgst := round(v_tax / 2, 2);
      v_sgst := v_tax - v_cgst;
    else
      v_igst := v_tax;
    end if;
    insert into public.billing_invoice_items (
      invoice_id, product_id, product_name, variant_name, sku, hsn_sac,
      quantity, unit_price, gst_rate, taxable_value, cgst, sgst, igst, line_total
    ) values (
      v_invoice_id, v_line.product_id, v_line.product_name, v_line.variant_name, v_line.sku, v_line.hsn_sac,
      v_line.quantity, v_line.unit_price, v_rate, v_taxable, v_cgst, v_sgst, v_igst, v_gross
    );
    v_subtotal := v_subtotal + v_taxable;
    v_cgst_total := v_cgst_total + v_cgst;
    v_sgst_total := v_sgst_total + v_sgst;
    v_igst_total := v_igst_total + v_igst;
  end loop;

  if v_order.shipping_fee > 0 then
    v_shipping_rate := case when v_settings.gst_enabled then v_settings.shipping_gst_rate else 0 end;
    v_taxable := case when v_shipping_rate > 0 then round(v_order.shipping_fee / (1 + v_shipping_rate / 100), 2) else v_order.shipping_fee end;
    v_shipping_tax := v_order.shipping_fee - v_taxable;
    v_shipping_cgst := 0; v_shipping_sgst := 0; v_shipping_igst := 0;
    if v_is_intra_state then
      v_shipping_cgst := round(v_shipping_tax / 2, 2);
      v_shipping_sgst := v_shipping_tax - v_shipping_cgst;
    else
      v_shipping_igst := v_shipping_tax;
    end if;
    insert into public.billing_invoice_items (
      invoice_id, product_name, quantity, unit_price, gst_rate, taxable_value, cgst, sgst, igst, line_total
    ) values (
      v_invoice_id, 'Shipping and handling', 1, v_order.shipping_fee, v_shipping_rate, v_taxable,
      v_shipping_cgst, v_shipping_sgst, v_shipping_igst, v_order.shipping_fee
    );
    v_subtotal := v_subtotal + v_taxable;
    v_cgst_total := v_cgst_total + v_shipping_cgst;
    v_sgst_total := v_sgst_total + v_shipping_sgst;
    v_igst_total := v_igst_total + v_shipping_igst;
  end if;

  if v_subtotal = 0 and not exists (select 1 from public.order_items where order_id = p_order_id) then
    raise exception 'An invoice requires at least one order item';
  end if;
  v_total := v_order.total;
  update public.billing_invoices set subtotal = v_subtotal, cgst_total = v_cgst_total,
    sgst_total = v_sgst_total, igst_total = v_igst_total, total = v_total
  where id = v_invoice_id;
  return v_invoice_id;
end;
$$;

create or replace function public.create_counter_invoice(
  p_customer jsonb,
  p_items jsonb,
  p_notes text default '',
  p_initial_payment numeric default 0,
  p_payment_method text default 'cash',
  p_reference text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings public.billing_settings%rowtype;
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_line record;
  v_invoice_id uuid;
  v_sequence bigint;
  v_fy_start integer;
  v_fy text;
  v_invoice_code text;
  v_customer_name text;
  v_customer_state text;
  v_is_intra_state boolean;
  v_quantity integer;
  v_unit_price numeric(12,2);
  v_rate numeric(5,2);
  v_gross numeric(12,2);
  v_taxable numeric(12,2);
  v_tax numeric(12,2);
  v_cgst numeric(12,2);
  v_sgst numeric(12,2);
  v_igst numeric(12,2);
  v_subtotal numeric(12,2) := 0;
  v_cgst_total numeric(12,2) := 0;
  v_sgst_total numeric(12,2) := 0;
  v_igst_total numeric(12,2) := 0;
  v_total numeric(12,2) := 0;
  v_seller_state_code text;
  v_buyer_state_code text;
begin
  if not coalesce((select public.is_admin()), false) then raise exception 'Administrator access is required'; end if;
  if jsonb_typeof(p_customer) <> 'object'
    or length(trim(coalesce(p_customer ->> 'name', ''))) not between 2 and 120
    or (nullif(regexp_replace(coalesce(p_customer ->> 'phone', ''), '\D', '', 'g'), '') is not null
      and length(regexp_replace(coalesce(p_customer ->> 'phone', ''), '\D', '', 'g')) not between 10 and 15)
  then raise exception 'Enter a customer name and a valid phone number, or leave the phone blank'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 100 then
    raise exception 'A counter invoice must contain between 1 and 100 items';
  end if;
  if coalesce(p_initial_payment, 0) < 0 then raise exception 'Initial payment cannot be negative'; end if;
  if p_payment_method not in ('cash', 'upi', 'bank_transfer', 'card', 'cheque', 'other') then raise exception 'Choose a valid payment method'; end if;

  select * into v_settings from public.billing_settings where id = true;
  if coalesce(v_settings.gst_enabled, false) and nullif(trim(v_settings.business_gstin), '') is null then
    raise exception 'Enter the business GSTIN in Billing settings before enabling GST';
  end if;
  v_customer_name := trim(p_customer ->> 'name');
  v_customer_state := trim(coalesce(p_customer ->> 'state', ''));
  if coalesce(v_settings.gst_enabled, false) then
    if upper(trim(v_settings.business_gstin)) !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$' then
      raise exception 'Enter a valid 15-character seller GSTIN before issuing a GST invoice';
    end if;
    v_seller_state_code := public.gst_state_code(v_settings.business_state);
    v_buyer_state_code := public.gst_state_code(v_customer_state);
    if v_seller_state_code is null or v_buyer_state_code is null then
      raise exception 'Enter valid seller and customer state names or GST state codes to calculate GST';
    end if;
    if left(upper(trim(v_settings.business_gstin)), 2) <> v_seller_state_code then
      raise exception 'Seller GSTIN state code does not match the business state';
    end if;
    if nullif(trim(p_customer ->> 'gstin'), '') is not null
      and (upper(trim(p_customer ->> 'gstin')) !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'
        or left(upper(trim(p_customer ->> 'gstin')), 2) <> v_buyer_state_code) then
      raise exception 'Buyer GSTIN is invalid or its state code does not match the customer state';
    end if;
  end if;
  v_is_intra_state := coalesce(v_seller_state_code = v_buyer_state_code, true);

  v_sequence := nextval('public.billing_invoice_sequence');
  v_fy_start := extract(year from current_date)::integer - case when extract(month from current_date) < 4 then 1 else 0 end;
  v_fy := v_fy_start::text || '-' || right((v_fy_start + 1)::text, 2);
  v_invoice_code := coalesce(nullif(trim(v_settings.invoice_prefix), ''), 'GR') || '/' || v_fy || '/' || lpad(v_sequence::text, 6, '0');

  insert into public.billing_invoices (
    invoice_sequence, invoice_code, order_id, issue_date,
    seller_name, seller_address, seller_city, seller_state, seller_postal_code, seller_gstin,
    buyer_name, buyer_phone, buyer_address, buyer_city, buyer_state, buyer_postal_code, buyer_gstin,
    notes, created_by
  ) values (
    v_sequence, v_invoice_code, null, current_date,
    coalesce(nullif(v_settings.business_name, ''), 'Giriraja'), v_settings.business_address,
    v_settings.business_city, v_settings.business_state, v_settings.business_postal_code,
    case when v_settings.gst_enabled then v_settings.business_gstin else '' end,
    v_customer_name, trim(coalesce(p_customer ->> 'phone', '')), trim(coalesce(p_customer ->> 'address', '')),
    trim(coalesce(p_customer ->> 'city', '')), v_customer_state, trim(coalesce(p_customer ->> 'postal_code', '')),
    trim(coalesce(p_customer ->> 'gstin', '')), left(trim(coalesce(p_notes, '')), 1000), auth.uid()
  ) returning id into v_invoice_id;

  for v_line in select value from jsonb_array_elements(p_items)
  loop
    if coalesce(v_line.value ->> 'quantity', '') !~ '^[1-9][0-9]{0,3}$' then raise exception 'Invalid item quantity'; end if;
    v_quantity := (v_line.value ->> 'quantity')::integer;
    select * into v_product from public.products p
      where p.id = (v_line.value ->> 'product_id')::uuid and p.is_active for update;
    if not found then raise exception 'A selected product is unavailable'; end if;

    if v_product.has_variants then
      if nullif(v_line.value ->> 'variant_id', '') is null then raise exception 'Choose an option for %', v_product.name; end if;
      update public.product_variants pv set stock_quantity = stock_quantity - v_quantity
        where pv.id = (v_line.value ->> 'variant_id')::uuid and pv.product_id = v_product.id
          and pv.is_active and pv.stock_quantity >= v_quantity
        returning pv.* into v_variant;
      if not found then raise exception 'The selected option is unavailable or out of stock'; end if;
      v_unit_price := v_variant.price;
    else
      if nullif(v_line.value ->> 'variant_id', '') is not null then raise exception 'Invalid option for product'; end if;
      update public.products p set stock_quantity = stock_quantity - v_quantity
        where p.id = v_product.id and p.stock_quantity >= v_quantity
        returning p.* into v_product;
      if not found then raise exception 'Product is out of stock'; end if;
      v_unit_price := v_product.price;
    end if;

    v_rate := case when v_settings.gst_enabled then v_product.gst_rate else 0 end;
    v_gross := round(v_unit_price * v_quantity, 2);
    v_taxable := case when v_rate > 0 then round(v_gross / (1 + v_rate / 100), 2) else v_gross end;
    v_tax := v_gross - v_taxable;
    v_cgst := 0; v_sgst := 0; v_igst := 0;
    if v_is_intra_state then
      v_cgst := round(v_tax / 2, 2);
      v_sgst := v_tax - v_cgst;
    else
      v_igst := v_tax;
    end if;
    insert into public.billing_invoice_items (
      invoice_id, product_id, product_name, variant_name, sku, hsn_sac,
      quantity, unit_price, gst_rate, taxable_value, cgst, sgst, igst, line_total
    ) values (
      v_invoice_id, v_product.id, v_product.name, case when v_product.has_variants then v_variant.name else '' end,
      coalesce(case when v_product.has_variants then v_variant.sku else v_product.sku end, ''), v_product.hsn_sac,
      v_quantity, v_unit_price, v_rate, v_taxable, v_cgst, v_sgst, v_igst, v_gross
    );
    v_subtotal := v_subtotal + v_taxable;
    v_total := v_total + v_gross;
    v_cgst_total := v_cgst_total + v_cgst;
    v_sgst_total := v_sgst_total + v_sgst;
    v_igst_total := v_igst_total + v_igst;
    v_variant := null;
  end loop;

  update public.billing_invoices set subtotal = v_subtotal, cgst_total = v_cgst_total,
    sgst_total = v_sgst_total, igst_total = v_igst_total, total = v_total
  where id = v_invoice_id;
  if coalesce(p_initial_payment, 0) > v_total then raise exception 'Initial payment cannot exceed the invoice total'; end if;
  if coalesce(p_initial_payment, 0) > 0 then
    perform public.record_invoice_payment(v_invoice_id, p_initial_payment, p_payment_method, p_reference);
  end if;
  return v_invoice_id;
end;
$$;

create or replace function public.record_invoice_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_reference text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.billing_invoices%rowtype;
  v_payment_id uuid;
begin
  if not coalesce((select public.is_admin()), false) then
    raise exception 'Administrator access is required';
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Payment amount must be greater than zero'; end if;
  if p_payment_method not in ('cash', 'upi', 'bank_transfer', 'card', 'cheque', 'other') then
    raise exception 'Choose a valid payment method';
  end if;
  select * into v_invoice from public.billing_invoices where id = p_invoice_id for update;
  if not found then raise exception 'Invoice not found'; end if;
  if v_invoice.status <> 'issued' then raise exception 'Payments can only be recorded on issued invoices'; end if;
  if round(p_amount, 2) > v_invoice.total - v_invoice.paid_total then raise exception 'Payment exceeds the outstanding balance'; end if;
  insert into public.billing_invoice_payments(invoice_id, amount, payment_method, reference, received_by)
  values (p_invoice_id, round(p_amount, 2), p_payment_method, left(trim(coalesce(p_reference, '')), 120), auth.uid())
  returning id into v_payment_id;
  update public.billing_invoices set paid_total = paid_total + round(p_amount, 2),
    payment_status = case when paid_total + round(p_amount, 2) >= total then 'paid' else 'part_paid' end
  where id = p_invoice_id;
  if v_invoice.paid_total + round(p_amount, 2) >= v_invoice.total then
    update public.orders set payment_status = 'paid' where id = v_invoice.order_id;
  end if;
  return v_payment_id;
end;
$$;

revoke all on function public.issue_order_invoice(uuid) from public, anon;
revoke all on function public.create_counter_invoice(jsonb, jsonb, text, numeric, text, text) from public, anon;
revoke all on function public.record_invoice_payment(uuid, numeric, text, text) from public, anon;
grant execute on function public.issue_order_invoice(uuid), public.create_counter_invoice(jsonb, jsonb, text, numeric, text, text), public.record_invoice_payment(uuid, numeric, text, text) to authenticated;

