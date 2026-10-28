-- Keep SECURITY DEFINER helpers out of the anonymous PostgREST surface.
revoke all on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated;

-- Anonymous catalog reads must not invoke an admin SECURITY DEFINER helper.
drop policy "Public can read active categories" on public.categories;
create policy "Anyone can read active categories"
  on public.categories for select to anon using (is_active);
create policy "Signed-in users can read active categories and admins all"
  on public.categories for select to authenticated
  using (is_active or (select public.is_admin()));

drop policy "Admins can manage categories" on public.categories;
create policy "Admins can insert categories" on public.categories for insert to authenticated
  with check ((select public.is_admin()));
create policy "Admins can update categories" on public.categories for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins can delete categories" on public.categories for delete to authenticated
  using ((select public.is_admin()));

drop policy "Public can read active products" on public.products;
create policy "Anyone can read active products"
  on public.products for select to anon using (is_active);
create policy "Signed-in users can read active products and admins all"
  on public.products for select to authenticated
  using (is_active or (select public.is_admin()));

drop policy "Admins can manage products" on public.products;
create policy "Admins can insert products" on public.products for insert to authenticated
  with check ((select public.is_admin()));
create policy "Admins can update products" on public.products for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins can delete products" on public.products for delete to authenticated
  using ((select public.is_admin()));

drop policy "Public can read active variants of active products" on public.product_variants;
create policy "Anyone can read active variants of active products"
  on public.product_variants for select to anon
  using (is_active and exists (
    select 1 from public.products p where p.id = product_id and p.is_active
  ));
create policy "Signed-in users can read active variants and admins all"
  on public.product_variants for select to authenticated
  using (
    (is_active and exists (
      select 1 from public.products p where p.id = product_id and p.is_active
    )) or (select public.is_admin())
  );

drop policy "Admins can manage product variants" on public.product_variants;
create policy "Admins can insert product variants" on public.product_variants for insert to authenticated
  with check ((select public.is_admin()));
create policy "Admins can update product variants" on public.product_variants for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins can delete product variants" on public.product_variants for delete to authenticated
  using ((select public.is_admin()));

drop policy "Admins can manage store settings" on public.store_settings;
create policy "Admins can insert store settings" on public.store_settings for insert to authenticated
  with check ((select public.is_admin()));
create policy "Admins can update store settings" on public.store_settings for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins can delete store settings" on public.store_settings for delete to authenticated
  using ((select public.is_admin()));

-- Preserve customer profile updates while allowing administrators to manage roles.
drop policy "Admins can manage profiles" on public.profiles;
drop policy "Customers can update their own non-role profile" on public.profiles;
create policy "Admins can insert profiles" on public.profiles for insert to authenticated
  with check ((select public.is_admin()));
create policy "Customers and admins can update profiles" on public.profiles for update to authenticated
  using (((select auth.uid()) = user_id and role = 'customer') or (select public.is_admin()))
  with check (((select auth.uid()) = user_id and role = 'customer') or (select public.is_admin()));
create policy "Admins can delete profiles" on public.profiles for delete to authenticated
  using ((select public.is_admin()));

-- Customer and admin reads are already covered by the customer read policy.
drop policy "Admins can manage order lines" on public.order_items;
create policy "Admins can insert order lines" on public.order_items for insert to authenticated
  with check ((select public.is_admin()));
create policy "Admins can update order lines" on public.order_items for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins can delete order lines" on public.order_items for delete to authenticated
  using ((select public.is_admin()));

-- Support foreign-key joins and efficient parent-row deletes.
create index if not exists favorites_product_id_idx on public.favorites(product_id);
create index if not exists order_items_product_id_idx on public.order_items(product_id);
create index if not exists order_items_variant_id_idx on public.order_items(variant_id);
