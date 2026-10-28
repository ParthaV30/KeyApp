-- Keep order writes behind the transactional SECURITY DEFINER RPCs. The app
-- only needs status updates for administrators; customers remain read-only.
revoke all on table public.orders, public.order_items from anon, public, authenticated;
grant select on table public.orders, public.order_items to authenticated;
grant update (status) on table public.orders to authenticated;

-- Profiles are created by the auth trigger and can only be read or updated
-- through the existing self/admin RLS policies.
revoke insert, delete on table public.profiles from anon, public, authenticated;
grant select, update on table public.profiles to authenticated;

-- Auth metadata is user supplied. Bound it before writing it into the profile
-- row so sign-up cannot store arbitrarily large display names or phone values.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name, phone)
  values (
    new.id,
    left(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 120),
    left(trim(coalesce(nullif(new.raw_user_meta_data ->> 'phone', ''), new.phone, '')), 20)
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
