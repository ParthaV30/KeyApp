-- A late payment on an invoice must not flip a cancelled order to "paid".
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
    update public.orders set payment_status='paid' where id=v_invoice.order_id and status <> 'cancelled';
  end if;
  return v_payment_id;
end;
$$;
