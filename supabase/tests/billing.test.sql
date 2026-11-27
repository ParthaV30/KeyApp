begin;

-- A ₹1,000 invoice, ₹400 of it returned: the customer owes ₹600.
-- Paying ₹600 must settle it; paying more must be refused.
do $fixture$
declare v_admin uuid := gen_random_uuid(); v_invoice uuid;
begin
  insert into auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (v_admin, 'authenticated', 'authenticated', v_admin || '@billing-test.invalid', '', '{}', '{}', now(), now());
  update public.profiles set role = 'admin' where user_id = v_admin;

  insert into public.billing_invoices (invoice_sequence, invoice_code, seller_name, buyer_name, subtotal, total)
  values (999999001, 'TEST/BILLING/999999001', 'Test seller', 'Test buyer', 1000, 1000) returning id into v_invoice;
  insert into public.billing_invoice_items (invoice_id, product_name, quantity, unit_price, taxable_value, line_total)
  values (v_invoice, 'Test item', 5, 200, 1000, 1000);

  perform set_config('keymitra_test.admin', v_admin::text, true);
  perform set_config('keymitra_test.invoice', v_invoice::text, true);
end;
$fixture$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('keymitra_test.admin'), true);

do $assertions$
declare
  v_invoice uuid := current_setting('keymitra_test.invoice')::uuid;
  v_row public.billing_invoices%rowtype;
begin
  perform public.issue_business_credit_note(v_invoice,
    jsonb_build_array(jsonb_build_object('invoice_item_id', (select id from public.billing_invoice_items where invoice_id = v_invoice), 'quantity', 2, 'restock', false)),
    'Test return');
  select * into v_row from public.billing_invoices where id = v_invoice;
  if v_row.credited_total <> 400 then raise exception 'a 2-of-5 return must credit 400, got %', v_row.credited_total; end if;

  begin
    perform public.record_business_invoice_payment(v_invoice, 601, 'cash', '');
    raise exception 'a payment above the balance after credit must be refused';
  exception when others then
    if sqlerrm not like 'Payment exceeds%' then raise; end if;
  end;

  perform public.record_business_invoice_payment(v_invoice, 600, 'cash', '');
  select * into v_row from public.billing_invoices where id = v_invoice;
  if v_row.payment_status <> 'paid' then raise exception 'paying the balance after credit must mark the invoice paid, got %', v_row.payment_status; end if;
end;
$assertions$;

reset role;
rollback;
