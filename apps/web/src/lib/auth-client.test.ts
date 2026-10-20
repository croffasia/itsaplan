import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { authBaseURL } from './auth-client';

describe('authBaseURL', () => {
  it('adds the better-auth mount to an API_URL that is an origin', () => {
    assert.equal(authBaseURL('https://api.example.com'), 'https://api.example.com/api/auth');
  });

  it('keeps the path of an API_URL served under a prefix', () => {
    assert.equal(
      authBaseURL('https://app.example.com/api'),
      'https://app.example.com/api/api/auth',
    );
    assert.equal(
      authBaseURL('https://app.example.com/api/'),
      'https://app.example.com/api/api/auth',
    );
  });
});
