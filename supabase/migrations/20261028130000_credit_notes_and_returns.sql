-- Returns and credit notes keep invoice balances, customer refunds, and
-- sellable stock aligned without rewriting issued invoice snapshots.

alter table public.billing_invoices
  add column if not exists credited_total numeric(12,2) not null default 0 check (credited_total >= 0);
alter table public.billing_invoices add constraint billing_invoices_credited_not_above_total check (credited_total <= total);
alter table public.billing_invoice_items
  add column if not exists returned_quantity integer not null default 0 check (returned_quantity >= 0 and returned_quantity <= quantity),
  add column if not exists variant_id uuid references public.product_variants(id) on delete set null;

update public.billing_invoice_items line set variant_id = order_line.variant_id
from public.billing_invoices invoice
join public.order_items order_line on order_line.order_id = invoice.order_id
where line.invoice_id = invoice.id and line.product_id = order_line.product_id
  and line.variant_id is null and order_line.variant_id is not null
  and line.sku = coalesce(order_line.sku,'');

create or replace function public.resolve_invoice_item_variant()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.variant_id is null and new.product_id is not null and nullif(trim(new.variant_name),'') is not null then
    select id into new.variant_id from public.product_variants
      where product_id = new.product_id and name = new.variant_name limit 1;
  end if;
  return new;
end;
$$;
revoke all on function public.resolve_invoice_item_variant() from public, anon, authenticated;
drop trigger if exists billing_invoice_items_resolve_variant on public.billing_invoice_items;
create trigger billing_invoice_items_resolve_variant before insert on public.billing_invoice_items
for each row execute function public.resolve_invoice_item_variant();

create sequence if not exists public.billing_credit_note_sequence;
create table if not exists public.billing_credit_notes (
  id uuid primary key default gen_random_uuid(),
  credit_note_sequence bigint not null unique,
  credit_note_code text not null unique,
  invoice_id uuid not null references public.billing_invoices(id) on delete restrict,
  issue_date date not null default current_date,
  reason text not null check (length(trim(reason)) between 3 and 500),
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  cgst_total numeric(12,2) not null default 0 check (cgst_total >= 0),
  sgst_total numeric(12,2) not null default 0 check (sgst_total >= 0),
  igst_total numeric(12,2) not null default 0 check (igst_total >= 0),
  total numeric(12,2) not null default 0 check (total >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.billing_credit_note_items (
  id uuid primary key default gen_random_uuid(),
  credit_note_id uuid not null references public.billing_credit_notes(id) on delete restrict,
  invoice_item_id uuid references public.billing_invoice_items(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_name text not null,
  variant_name text not null default '',
  sku text not null default '',
  hsn_sac text not null default '',
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  gst_rate numeric(5,2) not null default 0 check (gst_rate between 0 and 100),
  taxable_value numeric(12,2) not null check (taxable_value >= 0),
  cgst numeric(12,2) not null default 0 check (cgst >= 0),
  sgst numeric(12,2) not null default 0 check (sgst >= 0),
  igst numeric(12,2) not null default 0 check (igst >= 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  restocked boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.billing_credit_note_refunds (
  id uuid primary key default gen_random_uuid(),
  credit_note_id uuid not null references public.billing_credit_notes(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('cash','upi','bank_transfer','card','cheque','other')),
  reference text not null default '',
  refunded_at timestamptz not null default now(),
  refunded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create trigger billing_credit_notes_audit after insert or update or delete on public.billing_credit_notes
for each row execute function public.audit_business_change();
create trigger billing_credit_note_items_audit after insert or update or delete on public.billing_credit_note_items
for each row execute function public.audit_business_change();
create trigger billing_credit_note_refunds_audit after insert or update or delete on public.billing_credit_note_refunds
for each row execute function public.audit_business_change();
create index if not exists billing_credit_notes_invoice_date_idx on public.billing_credit_notes(invoice_id,issue_date desc);
create index if not exists billing_credit_note_items_credit_idx on public.billing_credit_note_items(credit_note_id);
create index if not exists billing_credit_note_refunds_credit_idx on public.billing_credit_note_refunds(credit_note_id,refunded_at desc);

alter table public.billing_credit_notes enable row level security;
alter table public.billing_credit_note_items enable row level security;
alter table public.billing_credit_note_refunds enable row level security;
create policy "Billing team can read credit notes" on public.billing_credit_notes for select to authenticated
  using ((select public.has_business_permission('billing')));
create policy "Billing team can read credit note lines" on public.billing_credit_note_items for select to authenticated
  using (exists(select 1 from public.billing_credit_notes n where n.id = credit_note_id and (select public.has_business_permission('billing'))));
create policy "Billing team can read credit note refunds" on public.billing_credit_note_refunds for select to authenticated
  using (exists(select 1 from public.billing_credit_notes n where n.id = credit_note_id and (select public.has_business_permission('billing'))));
grant select on public.billing_credit_notes, public.billing_credit_note_items, public.billing_credit_note_refunds to authenticated;
revoke all on public.billing_credit_notes, public.billing_credit_note_items, public.billing_credit_note_refunds from anon, public;
revoke insert, update, delete on public.billing_credit_notes, public.billing_credit_note_items, public.billing_credit_note_refunds from authenticated;
revoke all on sequence public.billing_credit_note_sequence from public, anon, authenticated;

create or replace function public.issue_business_credit_note(
  p_invoice_id uuid, p_items jsonb, p_reason text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_invoice public.billing_invoices%rowtype; v_line public.billing_invoice_items%rowtype; v_input jsonb;
  v_seq bigint; v_note_id uuid; v_note_code text; v_qty integer; v_subtotal numeric(12,2) := 0;
  v_cgst numeric(12,2) := 0; v_sgst numeric(12,2) := 0; v_igst numeric(12,2) := 0; v_total numeric(12,2) := 0;
  v_line_subtotal numeric(12,2); v_line_cgst numeric(12,2); v_line_sgst numeric(12,2); v_line_igst numeric(12,2); v_line_total numeric(12,2); v_prefix text;
  v_before integer; v_after integer; v_fy text;
begin
  if not public.has_business_permission('billing') then raise exception 'Billing access is required'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 100 then raise exception 'A credit note requires 1 to 100 return lines'; end if;
  if length(trim(coalesce(p_reason,''))) not between 3 and 500 then raise exception 'Enter a return reason'; end if;
  select * into v_invoice from public.billing_invoices where id = p_invoice_id for update;
  if not found or v_invoice.status <> 'issued' then raise exception 'Choose an issued invoice'; end if;
  select invoice_prefix into v_prefix from public.billing_settings where id=true;
  v_fy := case when extract(month from current_date) >= 4 then to_char(current_date,'YY') || '-' || to_char(current_date + interval '1 year','YY') else to_char(current_date - interval '1 year','YY') || '-' || to_char(current_date,'YY') end;
  v_seq := nextval('public.billing_credit_note_sequence');
  v_note_code := coalesce(nullif(trim(v_prefix),''),'GR') || '/CN/' || v_fy || '/' || lpad(v_seq::text,6,'0');
  insert into public.billing_credit_notes(credit_note_sequence,credit_note_code,invoice_id,reason,created_by)
  values(v_seq,left(v_note_code,80),p_invoice_id,left(trim(p_reason),500),auth.uid()) returning id into v_note_id;
  perform set_config('app.inventory.skip_stock_trigger','yes',true);
  for v_input in select value from jsonb_array_elements(p_items) loop
    if coalesce(v_input->>'quantity','') !~ '^[1-9][0-9]{0,4}$' then raise exception 'Return quantity is invalid'; end if;
    v_qty := (v_input->>'quantity')::integer;
    select * into v_line from public.billing_invoice_items where id = (v_input->>'invoice_item_id')::uuid and invoice_id = p_invoice_id for update;
    if not found then raise exception 'A returned item does not belong to this invoice'; end if;
    if v_line.returned_quantity + v_qty > v_line.quantity then raise exception 'Return quantity exceeds the remaining sold quantity'; end if;
    if coalesce((v_input->>'restock')::boolean,false) and v_line.product_id is null then raise exception 'A deleted product cannot be returned to inventory'; end if;
    v_line_subtotal := round(v_line.taxable_value / v_line.quantity * v_qty,2);
    v_line_cgst := round(v_line.cgst / v_line.quantity * v_qty,2);
    v_line_sgst := round(v_line.sgst / v_line.quantity * v_qty,2);
    v_line_igst := round(v_line.igst / v_line.quantity * v_qty,2);
    v_line_total := round(v_line.line_total / v_line.quantity * v_qty,2);
    insert into public.billing_credit_note_items(credit_note_id,invoice_item_id,product_id,variant_id,product_name,variant_name,sku,hsn_sac,quantity,unit_price,gst_rate,taxable_value,cgst,sgst,igst,line_total,restocked)
    values(v_note_id,v_line.id,v_line.product_id,v_line.variant_id,v_line.product_name,v_line.variant_name,v_line.sku,v_line.hsn_sac,v_qty,
      v_line.unit_price,v_line.gst_rate,v_line_subtotal,v_line_cgst,v_line_sgst,v_line_igst,v_line_total,coalesce((v_input->>'restock')::boolean,false));
    update public.billing_invoice_items set returned_quantity = returned_quantity + v_qty where id = v_line.id;
    if coalesce((v_input->>'restock')::boolean,false) then
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
    v_subtotal := v_subtotal + v_line_subtotal; v_cgst := v_cgst + v_line_cgst; v_sgst := v_sgst + v_line_sgst; v_igst := v_igst + v_line_igst; v_total := v_total + v_line_total;
  end loop;
  update public.billing_credit_notes set subtotal=v_subtotal,cgst_total=v_cgst,sgst_total=v_sgst,igst_total=v_igst,total=v_total where id=v_note_id;
  update public.billing_invoices set credited_total=credited_total+v_total,
    payment_status=case when paid_total+credited_total+v_total>=total then 'paid' when paid_total>0 then 'part_paid' else 'unpaid' end
    where id=p_invoice_id;
  if v_invoice.order_id is not null and v_invoice.paid_total+v_invoice.credited_total+v_total>=v_invoice.total then
    update public.orders set payment_status='paid' where id=v_invoice.order_id;
  end if;
  return v_note_id;
end;
$$;

create or replace function public.record_business_credit_note_refund(
  p_credit_note_id uuid, p_amount numeric, p_method text, p_reference text default ''
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_note public.billing_credit_notes%rowtype; v_invoice public.billing_invoices%rowtype; v_refund_id uuid; v_refunded numeric(12,2); v_due numeric(12,2);
begin
  if not public.has_business_permission('billing') then raise exception 'Billing access is required'; end if;
  if p_amount is null or p_amount <= 0 or p_method is null or p_method not in ('cash','upi','bank_transfer','card','cheque','other') then raise exception 'Enter a valid refund amount and method'; end if;
  select * into v_note from public.billing_credit_notes where id=p_credit_note_id for update;
  if not found then raise exception 'Credit note not found'; end if;
  select * into v_invoice from public.billing_invoices where id=v_note.invoice_id for update;
  select coalesce(sum(r.amount),0) into v_refunded from public.billing_credit_note_refunds r join public.billing_credit_notes n on n.id=r.credit_note_id where n.invoice_id=v_invoice.id;
  v_due := greatest(0,v_invoice.paid_total+v_invoice.credited_total-v_invoice.total-v_refunded);
  if round(p_amount,2) > v_due then raise exception 'Refund exceeds the customer refund due'; end if;
  insert into public.billing_credit_note_refunds(credit_note_id,amount,payment_method,reference,refunded_by)
  values(p_credit_note_id,round(p_amount,2),p_method,left(trim(coalesce(p_reference,'')),120),auth.uid()) returning id into v_refund_id;
  return v_refund_id;
end;
$$;

create or replace function public.record_business_invoice_payment(
  p_invoice_id uuid, p_amount numeric, p_method text, p_reference text default ''
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_invoice public.billing_invoices%rowtype; v_payment_id uuid;
begin
  if not public.has_business_permission('billing') then raise exception 'Billing access is required'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Payment amount must be greater than zero'; end if;
  if p_method is null or p_method not in ('cash','upi','bank_transfer','card','cheque','other') then raise exception 'Choose a valid payment method'; end if;
  select * into v_invoice from public.billing_invoices where id=p_invoice_id for update;
  if not found then raise exception 'Invoice not found'; end if;
  if v_invoice.status <> 'issued' then raise exception 'Payments can only be recorded on issued invoices'; end if;
  if round(p_amount,2) > greatest(0,v_invoice.total-v_invoice.paid_total-v_invoice.credited_total) then raise exception 'Payment exceeds the outstanding balance'; end if;
  insert into public.billing_invoice_payments(invoice_id,amount,payment_method,reference,received_by)
  values(p_invoice_id,round(p_amount,2),p_method,left(trim(coalesce(p_reference,'')),120),auth.uid()) returning id into v_payment_id;
  update public.billing_invoices set paid_total=paid_total+round(p_amount,2),
    payment_status=case when paid_total+round(p_amount,2)+credited_total>=total then 'paid' else 'part_paid' end where id=p_invoice_id;
  if v_invoice.order_id is not null and v_invoice.paid_total+round(p_amount,2)+v_invoice.credited_total>=v_invoice.total then
    update public.orders set payment_status='paid' where id=v_invoice.order_id;
  end if;
  return v_payment_id;
end;
$$;

revoke all on function public.issue_business_credit_note(uuid,jsonb,text), public.record_business_credit_note_refund(uuid,numeric,text,text) from public,anon;
grant execute on function public.issue_business_credit_note(uuid,jsonb,text), public.record_business_credit_note_refund(uuid,numeric,text,text) to authenticated;

create or replace function public.get_business_report_summary()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if not public.has_business_permission('reports') then raise exception 'Reports access is required'; end if;
  select jsonb_build_object(
    'monthly_sales', coalesce((select sum(total) from public.billing_invoices where status='issued' and issue_date>=date_trunc('month',current_date)::date),0)
      - coalesce((select sum(total) from public.billing_credit_notes where issue_date>=date_trunc('month',current_date)::date),0),
    'monthly_collections', coalesce((select sum(amount) from public.billing_invoice_payments where paid_at>=date_trunc('month',current_date)),0),
    'receivables', coalesce((select sum(greatest(total-paid_total-credited_total,0)) from public.billing_invoices where status='issued'),0),
    'overdue_receivables', coalesce((select sum(greatest(total-paid_total-credited_total,0)) from public.billing_invoices where status='issued' and due_date<current_date),0),
    'customer_refunds_due', coalesce((select sum(greatest(i.paid_total+i.credited_total-i.total-coalesce(r.refunded,0),0)) from public.billing_invoices i left join (select n.invoice_id,sum(r.amount) refunded from public.billing_credit_notes n join public.billing_credit_note_refunds r on r.credit_note_id=n.id group by n.invoice_id) r on r.invoice_id=i.id where i.status='issued'),0),
    'monthly_output_gst', coalesce((select sum(cgst_total+sgst_total+igst_total) from public.billing_invoices where status='issued' and issue_date>=date_trunc('month',current_date)::date),0)
      - coalesce((select sum(cgst_total+sgst_total+igst_total) from public.billing_credit_notes where issue_date>=date_trunc('month',current_date)::date),0),
    'monthly_expenses', coalesce((select sum(amount) from public.business_expenses where expense_date>=date_trunc('month',current_date)::date),0),
    'monthly_purchases', coalesce((select sum(total) from public.purchase_orders where ordered_at>=date_trunc('month',current_date)::date and status<>'cancelled'),0),
    'monthly_input_gst', coalesce((select sum(tax_total) from public.purchase_orders where ordered_at>=date_trunc('month',current_date)::date and status<>'cancelled'),0),
    'low_stock_items', (select count(*) from public.products where is_active and not has_variants and stock_quantity<=reorder_level)+(select count(*) from public.product_variants where is_active and stock_quantity<=reorder_level)
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function public.get_business_report_summary() from public,anon;
grant execute on function public.get_business_report_summary() to authenticated;

