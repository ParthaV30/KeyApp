-- Tag stock changes caused by customer sales and order cancellation with their
-- business references instead of leaving them as generic adjustments.

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
  v_reference_type := nullif(current_setting('app.inventory.reference_type', true), '');
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
  v_reference_type := nullif(current_setting('app.inventory.reference_type', true), '');
  v_reference_id := nullif(current_setting('app.inventory.reference_id', true), '')::uuid;
  insert into public.inventory_movements(product_id, variant_id, product_name, variant_name, movement_type, quantity_change, quantity_before, quantity_after, reason, reference_type, reference_id, performed_by)
  values (new.product_id, new.id, coalesce(v_product_name,''), new.name, v_type, v_delta, greatest(v_before,0), greatest(v_after,0), v_reason, v_reference_type, v_reference_id, auth.uid());
  return new;
end;
$$;

create or replace function public.protect_order_status_and_release_stock()
returns trigger language plpgsql security definer set search_path = '' as $$
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
    perform set_config('app.inventory.movement_type', 'order_release', true);
    perform set_config('app.inventory.reason', 'Cancelled customer order stock release', true);
    perform set_config('app.inventory.reference_type', 'order', true);
    perform set_config('app.inventory.reference_id', old.id::text, true);
    update public.products p set stock_quantity = stock_quantity + oi.quantity
      from public.order_items oi where oi.order_id = old.id and oi.product_id = p.id and oi.variant_id is null;
    update public.product_variants pv set stock_quantity = stock_quantity + oi.quantity
      from public.order_items oi where oi.order_id = old.id and oi.variant_id = pv.id;
    perform set_config('app.inventory.movement_type', '', true);
    perform set_config('app.inventory.reason', '', true);
    perform set_config('app.inventory.reference_type', '', true);
    perform set_config('app.inventory.reference_id', '', true);
    new.inventory_released := true;
  end if;
  return new;
end;
$$;

create or replace function public.classify_order_sale_movement()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_stock integer; v_movement_id uuid;
begin
  if new.variant_id is not null then
    select stock_quantity into v_stock from public.product_variants where id = new.variant_id;
    select id into v_movement_id from public.inventory_movements
      where product_id = new.product_id and variant_id = new.variant_id and movement_type = 'adjustment'
        and quantity_change = -new.quantity and quantity_after = v_stock
        and reason = 'Variant stock quantity updated' and created_at = transaction_timestamp()
        and performed_by is not distinct from auth.uid()
      order by id desc limit 1;
  else
    select stock_quantity into v_stock from public.products where id = new.product_id;
    select id into v_movement_id from public.inventory_movements
      where product_id = new.product_id and variant_id is null and movement_type = 'adjustment'
        and quantity_change = -new.quantity and quantity_after = v_stock
        and reason = 'Stock quantity updated' and created_at = transaction_timestamp()
        and performed_by is not distinct from auth.uid()
      order by id desc limit 1;
  end if;
  if v_movement_id is not null then
    update public.inventory_movements set movement_type='sale', reason='Customer order sale', reference_type='order', reference_id=new.order_id where id=v_movement_id;
  end if;
  return new;
end;
$$;
revoke all on function public.classify_order_sale_movement() from public, anon, authenticated;
drop trigger if exists order_items_classify_inventory_sale on public.order_items;
create trigger order_items_classify_inventory_sale after insert on public.order_items
for each row execute function public.classify_order_sale_movement();

create or replace function public.classify_counter_sale_movement()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_order_id uuid; v_stock integer; v_movement_id uuid;
begin
  select order_id into v_order_id from public.billing_invoices where id=new.invoice_id;
  if v_order_id is not null or new.product_id is null then return new; end if;
  if new.variant_id is not null then
    select stock_quantity into v_stock from public.product_variants where id=new.variant_id;
    select id into v_movement_id from public.inventory_movements
      where product_id=new.product_id and variant_id=new.variant_id and movement_type='adjustment'
        and quantity_change=-new.quantity and quantity_after=v_stock and reason='Variant stock quantity updated'
        and created_at=transaction_timestamp() and performed_by is not distinct from auth.uid()
      order by id desc limit 1;
  else
    select stock_quantity into v_stock from public.products where id=new.product_id;
    select id into v_movement_id from public.inventory_movements
      where product_id=new.product_id and variant_id is null and movement_type='adjustment'
        and quantity_change=-new.quantity and quantity_after=v_stock and reason='Stock quantity updated'
        and created_at=transaction_timestamp() and performed_by is not distinct from auth.uid()
      order by id desc limit 1;
  end if;
  if v_movement_id is not null then
    update public.inventory_movements set movement_type='sale', reason='Counter sale', reference_type='invoice', reference_id=new.invoice_id where id=v_movement_id;
  end if;
  return new;
end;
$$;
revoke all on function public.classify_counter_sale_movement() from public, anon, authenticated;
drop trigger if exists billing_invoice_items_classify_counter_sale on public.billing_invoice_items;
create trigger billing_invoice_items_classify_counter_sale after insert on public.billing_invoice_items
for each row execute function public.classify_counter_sale_movement();

-- Repair generic stock-adjustment labels written by the earlier inventory
-- trigger for sales created in the same transaction as their order/invoice.
update public.inventory_movements m
set movement_type='sale', reason='Customer order sale', reference_type='order', reference_id=o.id
from public.order_items oi join public.orders o on o.id=oi.order_id
where m.movement_type='adjustment' and m.reference_id is null
  and m.created_at=o.created_at and m.product_id=oi.product_id
  and m.variant_id is not distinct from oi.variant_id
  and m.quantity_change=-oi.quantity
  and m.reason in ('Stock quantity updated','Variant stock quantity updated');

update public.inventory_movements m
set movement_type='sale', reason='Counter sale', reference_type='invoice', reference_id=i.id
from public.billing_invoice_items ii join public.billing_invoices i on i.id=ii.invoice_id
where i.order_id is null and ii.product_id is not null
  and m.movement_type='adjustment' and m.reference_id is null
  and m.created_at=i.created_at and m.product_id=ii.product_id
  and m.variant_id is not distinct from ii.variant_id
  and m.quantity_change=-ii.quantity
  and m.reason in ('Stock quantity updated','Variant stock quantity updated');
