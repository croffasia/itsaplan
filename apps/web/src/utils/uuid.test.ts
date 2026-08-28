import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { uuid } from './uuid';

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// randomUUID sits on Crypto.prototype, so an own property is what shadows it; deleting
// that property uncovers the real one again.
function withoutRandomUUID(run: () => void) {
  Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });
  try {
    run();
  } finally {
    delete (crypto as { randomUUID?: unknown }).randomUUID;
  }
}

describe('uuid', () => {
  it('returns a v4 id when randomUUID is available', () => {
    assert.match(uuid(), V4);
  });

  it('returns a v4 id outside a secure context, where randomUUID is undefined', () => {
    withoutRandomUUID(() => {
      assert.equal(crypto.randomUUID, undefined);
      assert.match(uuid(), V4);
    });
    assert.equal(typeof crypto.randomUUID, 'function');
  });

  it('does not repeat itself on the fallback path', () => {
    withoutRandomUUID(() => {
      const ids = new Set(Array.from({ length: 500 }, () => uuid()));
      assert.equal(ids.size, 500);
    });
  });
});
