import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { consentRequest } from './consentRequest';

function redirectFor(uri: string) {
  return consentRequest(new URLSearchParams({ redirect_uri: uri })).redirect;
}

describe('consentRequest', () => {
  it('reads the client and the host the answer goes to', () => {
    const params = new URLSearchParams({
      client_id: 'abc',
      redirect_uri: 'https://chatgpt.com/connector/oauth/callback',
      sig: 'signed',
    });

    assert.deepEqual(consentRequest(params), {
      clientId: 'abc',
      redirect: { label: 'chatgpt.com', local: false },
    });
  });

  it('marks a loopback callback as an app on this computer', () => {
    assert.deepEqual(redirectFor('http://127.0.0.1:33418/callback'), {
      label: '127.0.0.1:33418',
      local: true,
    });
    assert.equal(redirectFor('http://localhost:51842/callback')?.local, true);
    assert.equal(redirectFor('http://[::1]:8080/callback')?.local, true);
  });

  it('names a custom scheme by the scheme alone', () => {
    assert.deepEqual(redirectFor('cursor://anysphere.cursor-retrieval/oauth/callback'), {
      label: 'cursor://',
      local: true,
    });
  });

  it('names no redirect when it is missing or not a URL', () => {
    assert.deepEqual(consentRequest(new URLSearchParams({ client_id: 'abc' })), {
      clientId: 'abc',
      redirect: null,
    });
    assert.equal(redirectFor('not a url'), null);
    assert.equal(consentRequest(new URLSearchParams()).clientId, null);
  });
});
