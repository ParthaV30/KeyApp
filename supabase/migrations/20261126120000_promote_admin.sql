-- Grants the admin role to the store owner's account if it already exists.
-- A fresh database has no such user yet, so this does nothing there (sign up, then re-run the update by hand).
update public.profiles set role = 'admin'
where user_id = (select id from auth.users where email = 'keymachienesales@gmail.com');
