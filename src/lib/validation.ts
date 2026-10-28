export type ShippingDetails = {
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  gstin?: string;
  note?: string;
};

const gstinPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string): boolean {
  const email = normalizeEmail(value);
  if (email.length > 254 || /\s/.test(email)) return false;
  const at = email.lastIndexOf('@');
  if (at < 1 || email.indexOf('@') !== at) return false;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (local.length > 64 || local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local)) return false;
  const labels = domain.split('.');
  return labels.length >= 2 && labels.every(label => label.length >= 1 && label.length <= 63 &&
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label)) && /^[a-z]{2,}$/i.test(labels.at(-1) ?? '');
}

export function normalizeSlug(value: string): string {
  return value.trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

export function validateSignUp(name: string, email: string, phone: string, password: string): string | null {
  if (name.trim().length < 2 || name.trim().length > 120) return 'Enter a name between 2 and 120 characters.';
  if (!isValidEmail(email) || normalizeEmail(email).length > 254) return 'Enter a valid email address.';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) return 'Enter a valid phone number with 10 to 15 digits.';
  if (password.length < 8 || password.length > 128) return 'Use a password between 8 and 128 characters.';
  return null;
}

export function validateShipping(details: ShippingDetails): string | null {
  if (details.name.trim().length < 2 || details.name.trim().length > 120) return 'Enter a name between 2 and 120 characters.';
  const digits = details.phone.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) return 'Enter a valid phone number with 10 to 15 digits.';
  if (details.address.trim().length < 5 || details.address.trim().length > 300) return 'Enter an address between 5 and 300 characters.';
  if (details.city.trim().length < 2 || details.city.trim().length > 100) return 'Enter a city between 2 and 100 characters.';
  if (details.state.trim().length < 2 || details.state.trim().length > 100) return 'Enter a state between 2 and 100 characters.';
  if (details.postalCode.trim().length < 3 || details.postalCode.trim().length > 20) return 'Enter a valid postal code.';
  if ((details.gstin?.trim() ?? '') && !gstinPattern.test(details.gstin!.trim().toUpperCase())) return 'Enter a valid 15-character GSTIN or leave it blank.';
  if ((details.note?.length ?? 0) > 1000) return 'Order notes must be 1,000 characters or fewer.';
  return null;
}

export function parseStoredCart(value: string | null): Record<string, number> {
  if (!value || value.length > 100_000) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([key, quantity]) =>
      key.length > 0 && key.length <= 160 && !['__proto__', 'constructor', 'prototype'].includes(key) &&
      Number.isInteger(quantity) && Number(quantity) >= 1 && Number(quantity) <= 99,
    )) as Record<string, number>;
  } catch {
    return {};
  }
}

export function parseStoredFavorites(value: string | null): string[] {
  if (!value || value.length > 100_000) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 160))].slice(0, 2000);
  } catch {
    return [];
  }
}
