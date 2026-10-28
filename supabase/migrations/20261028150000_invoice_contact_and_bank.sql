-- Seller contact and bank details printed on invoices. Existing admin-only RLS policies on billing_settings cover these columns.
alter table public.billing_settings
  add column if not exists business_phone text not null default '',
  add column if not exists business_email text not null default '',
  add column if not exists bank_account_name text not null default '',
  add column if not exists bank_name text not null default '',
  add column if not exists bank_branch text not null default '',
  add column if not exists bank_account_number text not null default '',
  add column if not exists bank_ifsc text not null default '',
  add column if not exists upi_id text not null default '',
  add column if not exists invoice_terms text not null default '';

alter table public.billing_settings
  drop constraint if exists billing_settings_business_email_format,
  add constraint billing_settings_business_email_format check (business_email = '' or business_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  drop constraint if exists billing_settings_bank_ifsc_format,
  add constraint billing_settings_bank_ifsc_format check (bank_ifsc = '' or bank_ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
  drop constraint if exists billing_settings_invoice_text_lengths,
  add constraint billing_settings_invoice_text_lengths check (
    char_length(business_phone) <= 40 and char_length(business_email) <= 120 and char_length(bank_account_name) <= 120
    and char_length(bank_name) <= 120 and char_length(bank_branch) <= 120 and char_length(bank_account_number) <= 34
    and char_length(upi_id) <= 80 and char_length(invoice_terms) <= 500
  );
