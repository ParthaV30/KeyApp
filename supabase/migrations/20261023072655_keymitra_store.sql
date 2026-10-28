create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  phone text not null default '',
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text not null default '',
  image_url text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.store_settings (
  id boolean primary key default true check (id),
  support_phone text not null default '+917022225055',
  dispatch_cutoff text not null default '18:00',
  default_shipping_fee numeric(12,2) not null default 0 check (default_shipping_fee >= 0),
  free_delivery_threshold numeric(12,2) check (free_delivery_threshold is null or free_delivery_threshold >= 0),
  updated_at timestamptz not null default now()
);
insert into public.store_settings(id) values (true) on conflict (id) do nothing;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  sku text unique,
  name text not null,
  description text not null default '',
  category_id uuid not null references public.categories(id) on delete restrict,
  brand text not null default '',
  image_url text,
  price numeric(12,2) check (price is null or price >= 0),
  compare_at_price numeric(12,2) check (compare_at_price is null or compare_at_price >= 0),
  has_variants boolean not null default false,
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  is_active boolean not null default false,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_price_required check (has_variants or price is not null)
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  sku text unique,
  price numeric(12,2) not null check (price >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_id, name)
);

create table public.favorites (
  customer_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (customer_id, product_id)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity unique,
  customer_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')),
  payment_method text not null default 'cod' check (payment_method = 'cod'),
  payment_status text not null default 'pay_on_delivery' check (payment_status in ('pay_on_delivery', 'paid', 'refunded')),
  inventory_released boolean not null default false,
  subtotal numeric(12,2) not null check (subtotal >= 0),
  shipping_fee numeric(12,2) not null default 0 check (shipping_fee >= 0),
  total numeric(12,2) not null check (total = subtotal + shipping_fee),
  shipping_name text not null,
  shipping_phone text not null,
  shipping_address text not null,
  shipping_city text not null,
  shipping_state text not null default '',
  shipping_postal_code text not null default '',
  customer_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_name text not null,
  variant_name text not null default '',
  sku text,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  line_total numeric(12,2) generated always as (unit_price * quantity) stored
);

create index products_active_category_idx on public.products(category_id, is_active, created_at desc);
create index products_search_idx on public.products using gin (to_tsvector('simple', name || ' ' || description || ' ' || brand));
create index product_variants_product_idx on public.product_variants(product_id, is_active, sort_order);
create index orders_customer_created_idx on public.orders(customer_id, created_at desc);
create index orders_status_created_idx on public.orders(status, created_at desc);
create index order_items_order_idx on public.order_items(order_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger categories_updated_at before update on public.categories for each row execute function public.set_updated_at();
create trigger settings_updated_at before update on public.store_settings for each row execute function public.set_updated_at();
create trigger products_updated_at before update on public.products for each row execute function public.set_updated_at();
create trigger variants_updated_at before update on public.product_variants for each row execute function public.set_updated_at();
create trigger orders_updated_at before update on public.orders for each row execute function public.set_updated_at();
revoke all on function public.set_updated_at() from public, anon, authenticated;

create or replace function public.protect_order_status_and_release_stock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status in ('cancelled', 'delivered') and new.status <> old.status then
    raise exception 'A completed or cancelled order cannot be reopened';
  end if;
  if (old.status = 'pending' and new.status not in ('pending', 'confirmed', 'cancelled'))
    or (old.status = 'confirmed' and new.status not in ('confirmed', 'processing', 'cancelled'))
    or (old.status = 'processing' and new.status not in ('processing', 'shipped', 'cancelled'))
    or (old.status = 'shipped' and new.status not in ('shipped', 'delivered'))
  then raise exception 'Invalid order status transition'; end if;
  if new.status = 'cancelled' and old.status <> 'cancelled' and not old.inventory_released then
    update public.products p set stock_quantity = stock_quantity + oi.quantity
    from public.order_items oi where oi.order_id = old.id and oi.product_id = p.id and oi.variant_id is null;
    update public.product_variants pv set stock_quantity = stock_quantity + oi.quantity
    from public.order_items oi where oi.order_id = old.id and oi.variant_id = pv.id;
    new.inventory_released := true;
  end if;
  return new;
end;
$$;
create trigger protect_order_status_and_restore_stock before update of status on public.orders
for each row execute function public.protect_order_status_and_release_stock();
revoke all on function public.protect_order_status_and_release_stock() from public, anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid()) and p.role = 'admin'
  );
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name, phone)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''), coalesce(nullif(new.raw_user_meta_data ->> 'phone', ''), new.phone, ''))
  on conflict (user_id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
revoke all on function public.handle_new_user() from public, anon, authenticated;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.store_settings enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.favorites enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy "Customers can read their profile; admins can read all" on public.profiles for select to authenticated
using ((select auth.uid()) = user_id or (select public.is_admin()));
create policy "Customers can update their own non-role profile" on public.profiles for update to authenticated
using ((select auth.uid()) = user_id and role = 'customer')
with check ((select auth.uid()) = user_id and role = 'customer');
create policy "Admins can manage profiles" on public.profiles for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "Public can read active categories" on public.categories for select to anon, authenticated
using (is_active or (select public.is_admin()));
create policy "Admins can manage categories" on public.categories for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Public can read store contact and delivery settings" on public.store_settings for select to anon, authenticated using (true);
create policy "Admins can manage store settings" on public.store_settings for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "Public can read active products" on public.products for select to anon, authenticated
using (is_active or (select public.is_admin()));
create policy "Admins can manage products" on public.products for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "Public can read active variants of active products" on public.product_variants for select to anon, authenticated
using (is_active and exists (select 1 from public.products p where p.id = product_id and p.is_active) or (select public.is_admin()));
create policy "Admins can manage product variants" on public.product_variants for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "Customers can manage their own favorites" on public.favorites for all to authenticated
using (customer_id = (select auth.uid()) or (select public.is_admin()))
with check (customer_id = (select auth.uid()) or (select public.is_admin()));

create policy "Customers can read their orders; admins can read all" on public.orders for select to authenticated
using (customer_id = (select auth.uid()) or (select public.is_admin()));
create policy "Admins can update orders" on public.orders for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "Customers can read their order lines; admins can read all" on public.order_items for select to authenticated
using (exists (select 1 from public.orders o where o.id = order_id and (o.customer_id = (select auth.uid()) or (select public.is_admin()))));
create policy "Admins can manage order lines" on public.order_items for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

grant select on public.categories, public.products, public.product_variants to anon, authenticated;
grant select on public.store_settings to anon, authenticated;
grant insert, update on public.store_settings to authenticated;
grant select, insert, delete on public.favorites to authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.orders, public.order_items to authenticated;
grant update on public.orders to authenticated;
grant all on public.categories, public.products, public.product_variants, public.profiles, public.orders, public.order_items to authenticated;

create or replace function public.place_cod_order(p_items jsonb, p_shipping jsonb, p_note text default '')
returns table(order_id uuid, order_number bigint, total numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid := auth.uid();
  v_order_id uuid;
  v_order_number bigint;
  v_subtotal numeric(12,2) := 0;
  v_line record;
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_unit_price numeric(12,2);
  v_name text;
  v_sku text;
  v_quantity integer;
  v_stock integer;
  v_shipping_fee numeric(12,2) := 0;
  v_free_delivery_threshold numeric(12,2);
begin
  if v_customer_id is null then raise exception 'Sign in is required to place an order'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 100 then
    raise exception 'Cart must contain between 1 and 100 items';
  end if;
  if jsonb_typeof(p_shipping) <> 'object'
    or length(trim(coalesce(p_shipping ->> 'name', ''))) not between 2 and 120
    or length(regexp_replace(coalesce(p_shipping ->> 'phone', ''), '\D', '', 'g')) not between 10 and 15
    or length(trim(coalesce(p_shipping ->> 'address', ''))) not between 5 and 300
    or length(trim(coalesce(p_shipping ->> 'city', ''))) not between 2 and 100
  then raise exception 'Shipping information is incomplete or invalid'; end if;

  insert into public.orders (
    customer_id, subtotal, shipping_fee, total, payment_method, payment_status,
    shipping_name, shipping_phone, shipping_address, shipping_city, shipping_state,
    shipping_postal_code, customer_note
  ) values (
    v_customer_id, 0, v_shipping_fee, v_shipping_fee, 'cod', 'pay_on_delivery',
    trim(p_shipping ->> 'name'), trim(p_shipping ->> 'phone'), trim(p_shipping ->> 'address'),
    trim(p_shipping ->> 'city'), trim(coalesce(p_shipping ->> 'state', '')),
    trim(coalesce(p_shipping ->> 'postal_code', '')), left(trim(coalesce(p_note, '')), 1000)
  ) returning id, orders.order_number into v_order_id, v_order_number;

  for v_line in select value from jsonb_array_elements(p_items)
  loop
    if (v_line.value ->> 'quantity') !~ '^[1-9][0-9]{0,3}$' then raise exception 'Invalid item quantity'; end if;
    v_quantity := (v_line.value ->> 'quantity')::integer;

    select * into v_product from public.products p
    where p.id = (v_line.value ->> 'product_id')::uuid and p.is_active
    for update;
    if not found then raise exception 'A product in your cart is no longer available'; end if;

    if v_product.has_variants then
      if nullif(v_line.value ->> 'variant_id', '') is null then raise exception 'Choose a product option before checkout'; end if;
      update public.product_variants pv set stock_quantity = stock_quantity - v_quantity
      where pv.id = (v_line.value ->> 'variant_id')::uuid and pv.product_id = v_product.id
        and pv.is_active and pv.stock_quantity >= v_quantity
      returning pv.* into v_variant;
      if not found then raise exception 'A selected option is out of stock'; end if;
      v_unit_price := v_variant.price;
      v_name := v_product.name;
      v_sku := coalesce(v_variant.sku, v_product.sku);
    else
      if nullif(v_line.value ->> 'variant_id', '') is not null then raise exception 'Invalid option for product'; end if;
      update public.products p set stock_quantity = stock_quantity - v_quantity
      where p.id = v_product.id and p.stock_quantity >= v_quantity
      returning p.stock_quantity into v_stock;
      if not found then raise exception 'A product is out of stock'; end if;
      v_unit_price := v_product.price;
      v_name := v_product.name;
      v_sku := v_product.sku;
    end if;

    v_subtotal := v_subtotal + v_unit_price * v_quantity;
    insert into public.order_items(order_id, product_id, variant_id, product_name, variant_name, sku, unit_price, quantity)
    values (v_order_id, v_product.id, case when v_product.has_variants then v_variant.id else null end,
      v_name, case when v_product.has_variants then v_variant.name else '' end, v_sku, v_unit_price, v_quantity);
    v_variant := null;
  end loop;

  select s.default_shipping_fee, s.free_delivery_threshold into v_shipping_fee, v_free_delivery_threshold
  from public.store_settings s where s.id = true;
  if v_free_delivery_threshold is not null and v_subtotal >= v_free_delivery_threshold then v_shipping_fee := 0; end if;
  v_shipping_fee := coalesce(v_shipping_fee, 0);
  update public.orders o set subtotal = v_subtotal, shipping_fee = v_shipping_fee, total = v_subtotal + v_shipping_fee where o.id = v_order_id;
  return query select v_order_id, v_order_number, v_subtotal + v_shipping_fee;
end;
$$;
revoke all on function public.place_cod_order(jsonb, jsonb, text) from public, anon;
grant execute on function public.place_cod_order(jsonb, jsonb, text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
create policy "Anyone can view product images" on storage.objects for select to anon, authenticated
using (bucket_id = 'product-images');
create policy "Admins can upload product images" on storage.objects for insert to authenticated
with check (bucket_id = 'product-images' and (select public.is_admin()));
create policy "Admins can update product images" on storage.objects for update to authenticated
using (bucket_id = 'product-images' and (select public.is_admin()))
with check (bucket_id = 'product-images' and (select public.is_admin()));
create policy "Admins can delete product images" on storage.objects for delete to authenticated
using (bucket_id = 'product-images' and (select public.is_admin()));
