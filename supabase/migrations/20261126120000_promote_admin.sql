-- Grants the admin role to an account that already exists (sign up first, then push).
-- Fails loudly if the account is missing so the migration is not recorded as applied.
do $$
begin
  update public.profiles set role = 'admin'
  where user_id = (select id from auth.users where email = 'keymachienesales@gmail.com');
  if not found then
    raise exception 'Sign up keymachienesales@gmail.com in the app (or add the user in the dashboard) before running this migration';
  end if;
end $$;
