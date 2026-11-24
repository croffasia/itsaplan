import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { withReaction } from './reactions';

const ana = { id: 'u-ana', name: 'Ana' };
const ben = { id: 'u-ben', name: 'Ben' };

describe('withReaction', () => {
  it('adds a new emoji at the end and the viewer after the others on an existing one', () => {
    const reactions = [{ emoji: '👍', users: [ben] }];
    assert.deepEqual(withReaction(reactions, '🎉', ana, true), [
      { emoji: '👍', users: [ben] },
      { emoji: '🎉', users: [ana] },
    ]);
    assert.deepEqual(withReaction(reactions, '👍', ana, true), [
      { emoji: '👍', users: [ben, ana] },
    ]);
  });

  it('removes only the viewer, and the emoji with its last member', () => {
    const reactions = [
      { emoji: '👍', users: [ben, ana] },
      { emoji: '🎉', users: [ana] },
    ];
    assert.deepEqual(withReaction(reactions, '👍', ana, false), [
      { emoji: '👍', users: [ben] },
      { emoji: '🎉', users: [ana] },
    ]);
    assert.deepEqual(withReaction(reactions, '🎉', ana, false), [
      { emoji: '👍', users: [ben, ana] },
    ]);
  });

  it('returns the same list when the viewer already holds the state', () => {
    const reactions = [{ emoji: '👍', users: [ana] }];
    assert.equal(withReaction(reactions, '👍', ana, true), reactions);
    assert.equal(withReaction(reactions, '🎉', ana, false), reactions);
  });
});
