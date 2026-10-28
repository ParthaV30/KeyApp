import assert from 'node:assert/strict';
import test from 'node:test';

import { signUpErrorMessage } from '../src/features/auth/authErrors.ts';

test('explains an email address that is already registered', () => {
  assert.match(signUpErrorMessage({ code: 'user_already_exists', message: 'User already registered' }), /already has an account/);
  assert.match(signUpErrorMessage({ message: 'User already registered' }), /already has an account/);
});

test('explains a confirmation email that could not be sent', () => {
  assert.match(signUpErrorMessage({ message: 'Error sending confirmation email' }), /confirmation email/);
  assert.match(signUpErrorMessage({ code: 'email_address_not_authorized', message: 'Email address not authorized' }), /confirmation email/);
});

test('explains rate limits and disabled sign-ups', () => {
  assert.match(signUpErrorMessage({ code: 'over_email_send_rate_limit', message: 'email rate limit exceeded' }), /hourly limit for sign-up emails/);
  assert.match(signUpErrorMessage({ code: 'over_request_rate_limit', message: 'Request rate limit reached' }), /Too many/);
  assert.match(signUpErrorMessage({ code: 'signup_disabled', message: 'Signups not allowed for this instance' }), /turned off/);
});

test('passes through password rules from the server', () => {
  assert.equal(signUpErrorMessage({ code: 'weak_password', message: 'Password should contain at least one character of each: abc, ABC, 123' }), 'Password should contain at least one character of each: abc, ABC, 123');
});

test('falls back to a generic message for unknown or missing errors', () => {
  assert.match(signUpErrorMessage(null), /try again/);
  assert.match(signUpErrorMessage({ message: '' }), /try again/);
  assert.match(signUpErrorMessage(new TypeError('Network request failed')), /connection/);
});
