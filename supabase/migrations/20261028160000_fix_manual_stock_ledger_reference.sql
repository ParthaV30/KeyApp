-- Manual stock changes (Inventory adjustments, Products "Update stock", editing a product's stock) carry no
-- business reference. The ledger triggers stored that as NULL, which violates inventory_movements.reference_type
-- NOT NULL (an explicit NULL bypasses the column default), so every manual stock change was rolled back.
-- Store an empty reference instead; sales and order releases still record their reference as before.

create or replace function public.capture_stock_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_before integer; v_after integer; v_delta integer; v_type text; v_reason text;
  v_reference_type text; v_reference_id uuid;
begin
  if current_setting('app.inventory.skip_stock_trigger', true) = 'yes' then return new; end if;
  if tg_op = 'INSERT' then v_before := 0; v_after := new.stock_quantity;
  else v_before := old.stock_quantity; v_after := new.stock_quantity; end if;
  v_delta := v_after - v_before;
  if v_delta = 0 then return new; end if;
  v_type := coalesce(nullif(current_setting('app.inventory.movement_type', true), ''), case when tg_op = 'INSERT' then 'opening' else 'adjustment' end);
  v_reason := left(coalesce(nullif(current_setting('app.inventory.reason', true), ''), 'Stock quantity updated'), 240);
  v_reference_type := coalesce(current_setting('app.inventory.reference_type', true), '');
  v_reference_id := nullif(current_setting('app.inventory.reference_id', true), '')::uuid;
  insert into public.inventory_movements(product_id, product_name, movement_type, quantity_change, quantity_before, quantity_after, reason, reference_type, reference_id, performed_by)
  values (new.id, new.name, v_type, v_delta, greatest(v_before,0), greatest(v_after,0), v_reason, v_reference_type, v_reference_id, auth.uid());
  return new;
end;
$$;

create or replace function public.capture_variant_stock_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_before integer; v_after integer; v_delta integer; v_type text; v_reason text; v_product_name text;
  v_reference_type text; v_reference_id uuid;
begin
  if current_setting('app.inventory.skip_stock_trigger', true) = 'yes' then return new; end if;
  if tg_op = 'INSERT' then v_before := 0; v_after := new.stock_quantity;
  else v_before := old.stock_quantity; v_after := new.stock_quantity; end if;
  v_delta := v_after - v_before;
  if v_delta = 0 then return new; end if;
  select name into v_product_name from public.products where id = new.product_id;
  v_type := coalesce(nullif(current_setting('app.inventory.movement_type', true), ''), case when tg_op = 'INSERT' then 'opening' else 'adjustment' end);
  v_reason := left(coalesce(nullif(current_setting('app.inventory.reason', true), ''), 'Variant stock quantity updated'), 240);
  v_reference_type := coalesce(current_setting('app.inventory.reference_type', true), '');
  v_reference_id := nullif(current_setting('app.inventory.reference_id', true), '')::uuid;
  insert into public.inventory_movements(product_id, variant_id, product_name, variant_name, movement_type, quantity_change, quantity_before, quantity_after, reason, reference_type, reference_id, performed_by)
  values (new.product_id, new.id, coalesce(v_product_name,''), new.name, v_type, v_delta, greatest(v_before,0), greatest(v_after,0), v_reason, v_reference_type, v_reference_id, auth.uid());
  return new;
end;
$$;
