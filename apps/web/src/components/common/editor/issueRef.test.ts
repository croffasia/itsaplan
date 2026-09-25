import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { splitIssueRefs } from './issueRef';

describe('issue ref text', () => {
  it('links only the keys it was given, longest key first', () => {
    assert.deepEqual(splitIssueRefs('See MKT-42 and OPS-7.', ['MKT', 'OPS']), [
      { kind: 'text', text: 'See ' },
      { kind: 'issue', key: 'MKT', sequence: 42 },
      { kind: 'text', text: ' and ' },
      { kind: 'issue', key: 'OPS', sequence: 7 },
      { kind: 'text', text: '.' },
    ]);
    assert.deepEqual(splitIssueRefs('AB-1 is not A-1', ['A', 'AB']), [
      { kind: 'issue', key: 'AB', sequence: 1 },
      { kind: 'text', text: ' is not ' },
      { kind: 'issue', key: 'A', sequence: 1 },
    ]);
  });

  it('leaves lowercase, other keys and joined words as text', () => {
    for (const text of ['mkt-42', 'Mkt-42', 'UTF-8', 'MKT-42x', 'xMKT-1', 'MKT-0', 'MKT-'])
      assert.deepEqual(splitIssueRefs(text, ['MKT']), [{ kind: 'text', text }], text);
    assert.deepEqual(splitIssueRefs('MKT-42', []), [{ kind: 'text', text: 'MKT-42' }]);
  });

  it('follows a change of keys', () => {
    assert.equal(splitIssueRefs('OPS-3', ['MKT']).length, 1);
    assert.deepEqual(splitIssueRefs('OPS-3', ['MKT', 'OPS']), [
      { kind: 'issue', key: 'OPS', sequence: 3 },
    ]);
  });
});
