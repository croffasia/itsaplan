import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { consentRequest } from './consentRequest';

describe('consentRequest', () => {
  it('reads the client and the host the answer goes to', () => {
    const params = new URLSearchParams({
      client_id: 'abc',
      redirect_uri: 'http://127.0.0.1:33418/callback',
      sig: 'signed',
    });

    assert.deepEqual(consentRequest(params), { clientId: 'abc', redirectHost: '127.0.0.1:33418' });
  });

  it('names no host when the redirect is missing or not a URL', () => {
    assert.deepEqual(consentRequest(new URLSearchParams({ client_id: 'abc' })), {
      clientId: 'abc',
      redirectHost: null,
    });
    assert.equal(
      consentRequest(new URLSearchParams({ redirect_uri: 'not a url' })).redirectHost,
      null,
    );
    assert.equal(consentRequest(new URLSearchParams()).clientId, null);
  });
});
