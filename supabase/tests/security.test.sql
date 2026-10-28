begin;

-- Disposable users and orders are created inside this transaction and removed
-- by rollback after the RLS checks below.
do $fixture$
declare
  v_user_a uuid := gen_random_uuid();
  v_user_b uuid := gen_random_uuid();
  v_order_a uuid;
  v_order_b uuid;
begin
  insert into auth.users (
    id, aud, role, email, encrypted_password, raw_app_meta_data,
    raw_user_meta_data, created_at, updated_at
  ) values
    (v_user_a, 'authenticated', 'authenticated', v_user_a || '@rls-test.invalid', '', '{}', '{}', now(), now()),
    (v_user_b, 'authenticated', 'authenticated', v_user_b || '@rls-test.invalid', '', '{}', '{}', now(), now());

  insert into public.orders (
    customer_id, subtotal, shipping_fee, total, shipping_name,
    shipping_phone, shipping_address, shipping_city
  ) values
    (v_user_a, 0, 0, 0, 'RLS test A', '9876543210', 'Test address A', 'Bengaluru')
    returning id into v_order_a;
  insert into public.orders (
    customer_id, subtotal, shipping_fee, total, shipping_name,
    shipping_phone, shipping_address, shipping_city
  ) values
    (v_user_b, 0, 0, 0, 'RLS test B', '9876543210', 'Test address B', 'Bengaluru')
    returning id into v_order_b;

  perform set_config('keymitra_test.user_a', v_user_a::text, true);
  perform set_config('keymitra_test.user_b', v_user_b::text, true);
  perform set_config('keymitra_test.order_b', v_order_b::text, true);
end;
$fixture$;

do $security_assertions$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.orders'::regclass) then
    raise exception 'orders must enforce row-level security';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.order_items'::regclass) then
    raise exception 'order_items must enforce row-level security';
  end if;
  if has_table_privilege('anon', 'public.orders', 'select') then
    raise exception 'anonymous users must not read orders';
  end if;
  if not has_table_privilege('authenticated', 'public.orders', 'select') then
    raise exception 'authenticated users need order reads subject to RLS';
  end if;
  if not has_column_privilege('authenticated', 'public.orders', 'status', 'update') then
    raise exception 'admins need a narrow status update grant';
  end if;
  if has_column_privilege('authenticated', 'public.orders', 'total', 'update') then
    raise exception 'authenticated users must not edit order totals';
  end if;
  if has_table_privilege('authenticated', 'public.orders', 'insert') then
    raise exception 'order creation must use the transactional RPC';
  end if;
  if has_table_privilege('authenticated', 'public.orders', 'delete') then
    raise exception 'orders must not be deleted through the table API';
  end if;
  if has_table_privilege('authenticated', 'public.order_items', 'insert') then
    raise exception 'order lines must not be inserted through the table API';
  end if;
  if has_table_privilege('authenticated', 'public.profiles', 'insert') then
    raise exception 'profile creation must use the auth trigger';
  end if;
  if has_table_privilege('authenticated', 'public.profiles', 'delete') then
    raise exception 'profiles must not be deleted through the table API';
  end if;
  if has_function_privilege('anon', 'public.place_cod_order(jsonb,jsonb,text)', 'execute') then
    raise exception 'anonymous users must not place orders';
  end if;
end;
$security_assertions$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('keymitra_test.user_a'), true);

do $customer_rls_assertions$
declare
  v_visible integer;
  v_changed integer;
begin
  select count(*) into v_visible from public.orders;
  if v_visible <> 1 then raise exception 'customer A must see only their own order'; end if;
  select count(*) into v_visible from public.profiles;
  if v_visible <> 1 then raise exception 'customer A must see only their own profile'; end if;

  begin
    update public.profiles set role = 'admin' where user_id = auth.uid();
    get diagnostics v_changed = row_count;
    if v_changed <> 0 then raise exception 'customers must not promote themselves'; end if;
  exception when insufficient_privilege then
    null;
  end;
  select count(*) into v_visible from public.profiles where user_id = auth.uid() and role = 'customer';
  if v_visible <> 1 then raise exception 'a rejected role change must leave the customer unchanged'; end if;

  update public.orders set status = 'cancelled'
    where id = current_setting('keymitra_test.order_b')::uuid;
  get diagnostics v_changed = row_count;
  if v_changed <> 0 then raise exception 'customer A must not change customer B order'; end if;
end;
$customer_rls_assertions$;

select set_config('request.jwt.claim.sub', current_setting('keymitra_test.user_b'), true);

do $second_customer_assertions$
declare
  v_visible integer;
begin
  select count(*) into v_visible from public.orders;
  if v_visible <> 1 then raise exception 'customer B must see only their own order'; end if;
  select count(*) into v_visible from public.profiles;
  if v_visible <> 1 then raise exception 'customer B must see only their own profile'; end if;
end;
$second_customer_assertions$;

reset role;
rollback;
