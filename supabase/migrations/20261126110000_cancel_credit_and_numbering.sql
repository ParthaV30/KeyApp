-- Item 10: gapless, consecutive document numbers. A counter row is locked by the
-- increment until the transaction ends, so a rolled-back document never burns a number.
create table if not exists public.billing_counters (
  name text primary key check (name in ('invoice', 'credit_note')),
  last_value bigint not null default 0
);
alter table public.billing_counters enable row level security;
revoke all on public.billing_counters from anon, authenticated, public;
insert into public.billing_counters(name, last_value) values
  ('invoice', coalesce((select max(invoice_sequence) from public.billing_invoices), 0)),
  ('credit_note', coalesce((select max(credit_note_sequence) from public.billing_credit_notes), 0))
on conflict (name) do nothing;

create or replace function public.next_billing_number(p_name text)
returns bigint language sql security definer set search_path = '' as $$
  update public.billing_counters set last_value = last_value + 1 where name = p_name returning last_value;
$$;
revoke all on function public.next_billing_number(text) from public, anon, authenticated;

-- Swap nextval() for the counter inside the two invoice creators without re-pasting them.
do $$
declare v_sig text; v_def text; v_new text;
begin
  foreach v_sig in array array['public.issue_order_invoice(uuid)', 'public.create_counter_invoice(jsonb,jsonb,text,numeric,text,text)'] loop
    v_def := pg_get_functiondef(v_sig::regprocedure);
    v_new := replace(v_def, 'nextval(''public.billing_invoice_sequence'')', 'public.next_billing_number(''invoice'')');
    if v_new = v_def then raise exception 'Expected invoice sequence call not found in %', v_sig; end if;
    execute v_new;
  end loop;
end $$;

-- Items 7 + 9: one credit-note routine shared by staff returns and order cancellation.
-- The final return of a line takes whatever remains of it, so rounded partial
-- credits can never add up to more than the invoice line (credited_total <= total).
create or replace function public.create_credit_note_internal(p_invoice_id uuid, p_items jsonb, p_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_invoice public.billing_invoices%rowtype; v_line public.billing_invoice_items%rowtype; v_input jsonb;
  v_seq bigint; v_note_id uuid; v_note_code text; v_qty integer; v_prefix text; v_fy text; v_before integer; v_after integer;
  v_restock boolean; v_last boolean;
  v_sub numeric(12,2); v_cgst numeric(12,2); v_sgst numeric(12,2); v_igst numeric(12,2); v_tot numeric(12,2);
  v_t_sub numeric(12,2) := 0; v_t_cgst numeric(12,2) := 0; v_t_sgst numeric(12,2) := 0; v_t_igst numeric(12,2) := 0; v_t_tot numeric(12,2) := 0;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 100 then raise exception 'A credit note requires 1 to 100 return lines'; end if;
  if length(trim(coalesce(p_reason,''))) not between 3 and 500 then raise exception 'Enter a return reason'; end if;
  select * into v_invoice from public.billing_invoices where id = p_invoice_id for update;
  if not found or v_invoice.status <> 'issued' then raise exception 'Choose an issued invoice'; end if;
  select invoice_prefix into v_prefix from public.billing_settings where id = true;
  v_fy := case when extract(month from current_date) >= 4 then to_char(current_date,'YY') || '-' || to_char(current_date + interval '1 year','YY') else to_char(current_date - interval '1 year','YY') || '-' || to_char(current_date,'YY') end;
  v_seq := public.next_billing_number('credit_note');
  v_note_code := coalesce(nullif(trim(v_prefix),''),'GR') || '/CN/' || v_fy || '/' || lpad(v_seq::text,6,'0');
  insert into public.billing_credit_notes(credit_note_sequence,credit_note_code,invoice_id,reason,created_by)
  values(v_seq,left(v_note_code,80),p_invoice_id,left(trim(p_reason),500),auth.uid()) returning id into v_note_id;
  for v_input in select value from jsonb_array_elements(p_items) loop
    if coalesce(v_input->>'quantity','') !~ '^[1-9][0-9]{0,4}$' then raise exception 'Return quantity is invalid'; end if;
    v_qty := (v_input->>'quantity')::integer;
    v_restock := coalesce((v_input->>'restock')::boolean,false);
    select * into v_line from public.billing_invoice_items where id = (v_input->>'invoice_item_id')::uuid and invoice_id = p_invoice_id for update;
    if not found then raise exception 'A returned item does not belong to this invoice'; end if;
    if v_line.returned_quantity + v_qty > v_line.quantity then raise exception 'Return quantity exceeds the remaining sold quantity'; end if;
    if v_restock and v_line.product_id is null then raise exception 'A deleted product cannot be returned to inventory'; end if;
    v_last := v_line.returned_quantity + v_qty = v_line.quantity;
    if v_last then
      select v_line.taxable_value - coalesce(sum(i.taxable_value),0), v_line.cgst - coalesce(sum(i.cgst),0), v_line.sgst - coalesce(sum(i.sgst),0),
             v_line.igst - coalesce(sum(i.igst),0), v_line.line_total - coalesce(sum(i.line_total),0)
        into v_sub, v_cgst, v_sgst, v_igst, v_tot
        from public.billing_credit_note_items i where i.invoice_item_id = v_line.id;
    else
      v_sub := round(v_line.taxable_value / v_line.quantity * v_qty,2); v_cgst := round(v_line.cgst / v_line.quantity * v_qty,2);
      v_sgst := round(v_line.sgst / v_line.quantity * v_qty,2); v_igst := round(v_line.igst / v_line.quantity * v_qty,2);
      v_tot := round(v_line.line_total / v_line.quantity * v_qty,2);
    end if;
    insert into public.billing_credit_note_items(credit_note_id,invoice_item_id,product_id,variant_id,product_name,variant_name,sku,hsn_sac,quantity,unit_price,gst_rate,taxable_value,cgst,sgst,igst,line_total,restocked)
    values(v_note_id,v_line.id,v_line.product_id,v_line.variant_id,v_line.product_name,v_line.variant_name,v_line.sku,v_line.hsn_sac,v_qty,
      v_line.unit_price,v_line.gst_rate,v_sub,v_cgst,v_sgst,v_igst,v_tot,v_restock);
    update public.billing_invoice_items set returned_quantity = returned_quantity + v_qty where id = v_line.id;
    if v_restock then
      perform set_config('app.inventory.skip_stock_trigger','yes',true);
      if v_line.variant_id is not null then
        select stock_quantity into v_before from public.product_variants where id = v_line.variant_id for update;
        if not found then raise exception 'The returned product option no longer exists'; end if;
        v_after := v_before + v_qty;
        update public.product_variants set stock_quantity = v_after where id = v_line.variant_id;
      else
        select stock_quantity into v_before from public.products where id = v_line.product_id for update;
        if not found then raise exception 'The returned product no longer exists'; end if;
        v_after := v_before + v_qty;
        update public.products set stock_quantity = v_after where id = v_line.product_id;
      end if;
      insert into public.inventory_movements(product_id,variant_id,product_name,variant_name,movement_type,quantity_change,quantity_before,quantity_after,reason,reference_type,reference_id,performed_by)
      values(v_line.product_id,v_line.variant_id,v_line.product_name,v_line.variant_name,'return',v_qty,v_before,v_after,
        left('Customer return: ' || trim(p_reason),240),'credit_note',v_note_id,auth.uid());
    end if;
    v_t_sub := v_t_sub + v_sub; v_t_cgst := v_t_cgst + v_cgst; v_t_sgst := v_t_sgst + v_sgst; v_t_igst := v_t_igst + v_igst; v_t_tot := v_t_tot + v_tot;
  end loop;
  update public.billing_credit_notes set subtotal=v_t_sub,cgst_total=v_t_cgst,sgst_total=v_t_sgst,igst_total=v_t_igst,total=v_t_tot where id=v_note_id;
  update public.billing_invoices set credited_total=credited_total+v_t_tot,
    payment_status=case when paid_total+credited_total+v_t_tot>=total then 'paid' when paid_total>0 then 'part_paid' else 'unpaid' end
    where id=p_invoice_id;
  if v_invoice.order_id is not null and v_invoice.paid_total+v_invoice.credited_total+v_t_tot>=v_invoice.total then
    update public.orders set payment_status='paid' where id=v_invoice.order_id and status <> 'cancelled';
  end if;
  return v_note_id;
end;
$$;
revoke all on function public.create_credit_note_internal(uuid,jsonb,text) from public, anon, authenticated;

create or replace function public.issue_business_credit_note(p_invoice_id uuid, p_items jsonb, p_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_business_permission('billing') then raise exception 'Billing access is required'; end if;
  return public.create_credit_note_internal(p_invoice_id, p_items, p_reason);
end;
$$;
revoke all on function public.issue_business_credit_note(uuid,jsonb,text) from public, anon;
grant execute on function public.issue_business_credit_note(uuid,jsonb,text) to authenticated;

-- Item 7: when an order is cancelled, its issued invoice is closed out automatically.
--   * nothing received and not yet in a filed GST period -> void the invoice (number is kept);
--   * a payment was received, or the GST invoice belongs to an earlier month (already
--     reportable) -> issue a full credit note for the unreturned lines (stock was already
--     released by the cancellation, so no restock). Refunds then show up as "refund due".
create or replace function public.settle_invoice_for_cancelled_order()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_invoice public.billing_invoices%rowtype; v_items jsonb;
begin
  if new.status <> 'cancelled' or old.status = 'cancelled' then return new; end if;
  select * into v_invoice from public.billing_invoices where order_id = new.id and status = 'issued' for update;
  if not found then return new; end if;
  if v_invoice.paid_total = 0 and v_invoice.credited_total = 0
     and not (v_invoice.seller_gstin <> '' and v_invoice.issue_date < date_trunc('month', current_date)::date) then
    update public.billing_invoices set status = 'void', notes = left(trim(notes || ' [Voided: order cancelled]'), 1000) where id = v_invoice.id;
    return new;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('invoice_item_id', id, 'quantity', quantity - returned_quantity, 'restock', false)), '[]'::jsonb)
    into v_items from public.billing_invoice_items where invoice_id = v_invoice.id and quantity > returned_quantity;
  if jsonb_array_length(v_items) > 0 then
    perform public.create_credit_note_internal(v_invoice.id, v_items, 'Order #' || new.order_number || ' cancelled');
  end if;
  return new;
end;
$$;
revoke all on function public.settle_invoice_for_cancelled_order() from public, anon, authenticated;
drop trigger if exists orders_settle_invoice_on_cancel on public.orders;
create trigger orders_settle_invoice_on_cancel after update of status on public.orders
for each row execute function public.settle_invoice_for_cancelled_order();
