-- LOCAL DEVELOPMENT ONLY: a ready-made admin (admin@keymitra.local / KeyMitra-Admin-1).
-- Not listed in config.toml, so `db reset` and `db push --include-seed` never create it. Run: npm run db:seed-admin
do $$
declare v_id uuid := '00000000-0000-4000-8000-00000000ad01';
begin
  if exists (select 1 from auth.users where email = 'admin@keymitra.local') then return; end if;
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', 'admin@keymitra.local',
    extensions.crypt('KeyMitra-Admin-1', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{"display_name":"Local Admin","phone":"9999999999"}', now(), now(),
    '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id, v_id::text, 'email',
    jsonb_build_object('sub', v_id::text, 'email', 'admin@keymitra.local', 'email_verified', true), now(), now(), now());
  update public.profiles set role = 'admin' where user_id = v_id;
end $$;
