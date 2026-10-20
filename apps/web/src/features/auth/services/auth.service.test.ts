import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EmailNotConfirmedError, signInError } from './auth.service';

// The sign-in form offers to send the confirmation link again only when the address is
// what stopped the sign-in. The api answers 403 for other refusals too.
describe('signInError', () => {
  it('reports an unconfirmed address', () => {
    const error = signInError({
      code: 'EMAIL_NOT_VERIFIED',
      message: 'Confirm your email address before signing in',
    });
    assert.ok(error instanceof EmailNotConfirmedError);
  });

  it('does not report a deactivated account as unconfirmed', () => {
    const error = signInError({
      code: 'ACCOUNT_DEACTIVATED',
      message: 'This account is deactivated',
    });
    assert.ok(!(error instanceof EmailNotConfirmedError));
    assert.equal(error.message, 'This account is deactivated');
  });

  it('does not report a disabled password form as unconfirmed', () => {
    const error = signInError({
      code: 'PASSWORD_AUTH_DISABLED',
      message: 'Password sign-in is disabled on this instance',
    });
    assert.ok(!(error instanceof EmailNotConfirmedError));
  });
});
