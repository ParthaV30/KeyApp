import { supabase } from '@/lib/supabase';
import type { SellerDetails } from './draftInvoice';
import type { InvoiceProfile } from './invoiceDocument';

const COLUMNS = 'business_phone,business_email,bank_account_name,bank_name,bank_branch,bank_account_number,bank_ifsc,upi_id,invoice_terms';

type ProfileRow = Partial<Record<string, string>>;

const fromRow = (row: ProfileRow): Required<InvoiceProfile> => ({
  phone: row.business_phone ?? '',
  email: row.business_email ?? '',
  bankAccountName: row.bank_account_name ?? '',
  bankName: row.bank_name ?? '',
  bankBranch: row.bank_branch ?? '',
  bankAccountNumber: row.bank_account_number ?? '',
  bankIfsc: row.bank_ifsc ?? '',
  upiId: row.upi_id ?? '',
  terms: row.invoice_terms ?? '',
});

export const emptyInvoiceProfile: Required<InvoiceProfile> = fromRow({});

// `available` is false until the invoice contact migration is applied; bills still print with the store phone.
export async function loadInvoiceProfile(): Promise<{ profile: Required<InvoiceProfile>; available: boolean }> {
  if (!supabase) return { profile: emptyInvoiceProfile, available: false };
  const [billing, store] = await Promise.all([
    supabase.from('billing_settings').select(COLUMNS).eq('id', true).maybeSingle(),
    supabase.from('store_settings').select('support_phone').eq('id', true).maybeSingle(),
  ]);
  const storePhone = (store.data as { support_phone?: string } | null)?.support_phone ?? '';
  if (billing.error) return { profile: { ...emptyInvoiceProfile, phone: storePhone }, available: false };
  const profile = fromRow((billing.data ?? {}) as ProfileRow);
  return { profile: { ...profile, phone: profile.phone || storePhone }, available: true };
}

const defaultSeller: SellerDetails = { name: 'Giriraja', address: '', city: 'Bengaluru', state: 'Karnataka', postalCode: '', gstin: '', gstEnabled: false };

// Seller block for draft previews; issued invoices carry their own snapshot of these fields.
export async function loadSellerDetails(): Promise<SellerDetails> {
  if (!supabase) return defaultSeller;
  const { data, error } = await supabase.from('billing_settings')
    .select('business_name,business_address,business_city,business_state,business_postal_code,business_gstin,gst_enabled')
    .eq('id', true).maybeSingle();
  if (error || !data) return defaultSeller;
  return {
    name: data.business_name || defaultSeller.name,
    address: data.business_address ?? '',
    city: data.business_city ?? '',
    state: data.business_state ?? '',
    postalCode: data.business_postal_code ?? '',
    gstin: data.business_gstin ?? '',
    gstEnabled: Boolean(data.gst_enabled),
  };
}

export function validateInvoiceProfile(profile: Required<InvoiceProfile>): string | null {
  if (profile.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(profile.email)) return 'Enter a valid email address for invoices.';
  if (profile.bankIfsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(profile.bankIfsc)) return 'IFSC should look like CNRB0001234 (11 characters).';
  return null;
}

export async function saveInvoiceProfile(profile: Required<InvoiceProfile>) {
  if (!supabase) return { error: { message: 'Backend not configured' } };
  return supabase.from('billing_settings').update({
    business_phone: profile.phone.trim(),
    business_email: profile.email.trim(),
    bank_account_name: profile.bankAccountName.trim(),
    bank_name: profile.bankName.trim(),
    bank_branch: profile.bankBranch.trim(),
    bank_account_number: profile.bankAccountNumber.trim(),
    bank_ifsc: profile.bankIfsc.trim().toUpperCase(),
    upi_id: profile.upiId.trim(),
    invoice_terms: profile.terms.trim(),
  }).eq('id', true);
}
