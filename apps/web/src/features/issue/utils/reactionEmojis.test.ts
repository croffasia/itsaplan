import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MORE_REACTION_EMOJIS, PINNED_REACTION_EMOJIS } from './reactionEmojis';

describe('the picker set', () => {
  it('holds only single emoji the api accepts, each once', () => {
    const all = [...PINNED_REACTION_EMOJIS, ...MORE_REACTION_EMOJIS];
    // The rule the api applies to a reaction.
    const single = new RegExp('^\\p{RGI_Emoji}$', 'v');
    for (const emoji of all) assert.match(emoji, single);
    assert.equal(new Set(all).size, all.length);
  });
});
