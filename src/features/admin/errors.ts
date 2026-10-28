export function adminErrorMessage(error: { code?: string; message?: string }, fallback: string): string {
  if (error.code === '23505') return 'That name, URL slug, or SKU is already in use.';
  if (error.code === '23503') return 'This record is linked to existing store data and cannot be changed.';
  if (error.code === '42501') return 'Your admin access could not be verified. Sign in again and retry.';
  // P0001 is a `raise exception` from our own database functions, whose messages are written for staff.
  if (error.code === 'P0001' && error.message) return error.message;
  return fallback;
}
