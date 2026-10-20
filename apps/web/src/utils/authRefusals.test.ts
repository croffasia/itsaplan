import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { authRefusalKey } from './authRefusals';

describe('authRefusalKey', () => {
  it('names each refusal of the registration gate', () => {
    assert.equal(authRefusalKey('REGISTRATION_CLOSED'), 'registrationClosed');
    assert.equal(authRefusalKey('INVITE_ONLY'), 'inviteOnly');
    assert.equal(authRefusalKey('EMAIL_DOMAIN_NOT_ALLOWED'), 'emailDomainNotAllowed');
  });

  it('names the refusals of the sign-in, sign-up and reset forms', () => {
    assert.equal(authRefusalKey('INVALID_EMAIL_OR_PASSWORD'), 'invalidCredentials');
    assert.equal(authRefusalKey('INVALID_USERNAME_OR_PASSWORD'), 'invalidCredentials');
    assert.equal(authRefusalKey('USERNAME_TOO_SHORT'), 'invalidCredentials');
    assert.equal(authRefusalKey('USERNAME_TOO_LONG'), 'invalidCredentials');
    assert.equal(authRefusalKey('INVALID_USERNAME'), 'invalidCredentials');
    assert.equal(authRefusalKey('INVALID_EMAIL'), 'invalidEmail');
    assert.equal(authRefusalKey('VALIDATION_ERROR'), 'invalidEmail');
    assert.equal(authRefusalKey('PASSWORD_TOO_SHORT'), 'passwordTooShort');
    assert.equal(authRefusalKey('PASSWORD_TOO_LONG'), 'passwordTooLong');
    assert.equal(authRefusalKey('USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL'), 'emailTaken');
    assert.equal(authRefusalKey('USER_ALREADY_EXISTS'), 'emailTaken');
    assert.equal(authRefusalKey('ACCOUNT_DEACTIVATED'), 'accountDeactivated');
    assert.equal(authRefusalKey('PASSWORD_AUTH_DISABLED'), 'passwordDisabled');
    assert.equal(authRefusalKey('EMAIL_NOT_VERIFIED'), 'emailNotVerified');
  });

  it('names a rate-limited request by its status, which carries no code', () => {
    assert.equal(authRefusalKey(undefined, 429), 'tooManyRequests');
  });

  it('leaves any other code to the caller', () => {
    assert.equal(authRefusalKey('INVALID_TOKEN'), undefined);
    assert.equal(authRefusalKey('AUTH_CANCELLED', 400), undefined);
    assert.equal(authRefusalKey('toString'), undefined);
    assert.equal(authRefusalKey(undefined), undefined);
  });
});
