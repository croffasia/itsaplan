import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { registrationRefusalKey } from './registrationRefusals';

describe('registrationRefusalKey', () => {
  it('names each refusal of the registration gate', () => {
    assert.equal(registrationRefusalKey('REGISTRATION_CLOSED'), 'registrationClosed');
    assert.equal(registrationRefusalKey('INVITE_ONLY'), 'inviteOnly');
    assert.equal(registrationRefusalKey('EMAIL_DOMAIN_NOT_ALLOWED'), 'emailDomainNotAllowed');
  });

  it('leaves any other code to the caller', () => {
    assert.equal(registrationRefusalKey('USER_ALREADY_EXISTS'), undefined);
    assert.equal(registrationRefusalKey('toString'), undefined);
    assert.equal(registrationRefusalKey(undefined), undefined);
  });
});
