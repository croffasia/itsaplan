import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AuthError, EmailNotConfirmedError, authError } from './auth.service';

describe('authError', () => {
  // The form words a refusal by these, since the server's message is English.
  it('keeps the code and the status of the refusal', () => {
    const error = authError({ code: 'INVALID_EMAIL_OR_PASSWORD', message: 'Invalid', status: 401 });
    assert.ok(error instanceof AuthError);
    assert.equal(error.code, 'INVALID_EMAIL_OR_PASSWORD');
    assert.equal(error.status, 401);
    assert.equal(error.message, 'Invalid');
  });

  // The sign-in form offers to send the confirmation link again only when the address
  // is what stopped the sign-in. The api answers 403 for other refusals too.
  it('reports an unconfirmed address', () => {
    const error = authError({
      code: 'EMAIL_NOT_VERIFIED',
      message: 'Confirm your email address before signing in',
      status: 403,
    });
    assert.ok(error instanceof EmailNotConfirmedError);
  });

  it('does not report a deactivated account as unconfirmed', () => {
    const error = authError({
      code: 'ACCOUNT_DEACTIVATED',
      message: 'This account is deactivated',
      status: 403,
    });
    assert.ok(!(error instanceof EmailNotConfirmedError));
  });

  it('does not report a disabled password form as unconfirmed', () => {
    const error = authError({
      code: 'PASSWORD_AUTH_DISABLED',
      message: 'Password sign-in is disabled on this instance',
      status: 403,
    });
    assert.ok(!(error instanceof EmailNotConfirmedError));
  });
});
