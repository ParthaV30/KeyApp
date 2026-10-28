// Turns Supabase sign-up failures into messages a customer can act on. Supabase sends a stable
// `code` on newer errors and only a message on older ones, so both are checked.

type AuthErrorLike = { code?: string; message?: string } | null | undefined;

const GENERIC = 'Account creation failed. Please try again in a few minutes.';

export function signUpErrorMessage(error: unknown): string {
  if (error instanceof TypeError) return 'Could not reach the server. Check your internet connection and try again.';
  const { code = '', message = '' } = (error ?? {}) as Exclude<AuthErrorLike, null | undefined>;
  const text = `${code} ${message}`.toLowerCase();

  if (code === 'user_already_exists' || text.includes('already registered')) {
    return 'This email already has an account. Sign in instead, or use a different email.';
  }
  if (code === 'email_address_not_authorized' || text.includes('confirmation email') || text.includes('sending')) {
    return 'We could not send the confirmation email, so the account was not created. Please contact the shop or try again later.';
  }
  // Supabase's built-in mailer allows only a few emails an hour, so this is not a "wait a minute" case.
  if (code === 'over_email_send_rate_limit' || text.includes('email rate limit')) {
    return 'We have hit the hourly limit for sign-up emails, so the account was not created. Please try again in about an hour, or contact the shop.';
  }
  if (text.includes('rate limit') || code === 'over_request_rate_limit') {
    return 'Too many sign-up attempts right now. Please wait a few minutes and try again.';
  }
  if (code === 'signup_disabled' || text.includes('signups not allowed')) {
    return 'New account sign-ups are turned off for this shop at the moment.';
  }
  if (code === 'weak_password' && message) return message;
  if (code === 'email_address_invalid' || text.includes('invalid email')) return 'Enter a valid email address.';
  return GENERIC;
}
