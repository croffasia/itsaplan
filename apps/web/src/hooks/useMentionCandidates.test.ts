import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Assignee } from '@/lib/api/endpoints/projects';
import { mentionCandidatesFrom, offersMention } from './useMentionCandidates';

function assignee(over: Partial<Assignee>): Assignee {
  return {
    userId: over.username ?? 'u',
    name: over.username ?? 'u',
    email: '',
    username: null,
    image: null,
    kind: 'member',
    agentKind: null,
    restrictedToUserId: null,
    respondsToMention: null,
    canReadWorkItems: true,
    ...over,
  };
}

describe('mentionCandidatesFrom', () => {
  it('offers people and the agents a mention by this user would start', () => {
    const offered = mentionCandidatesFrom(
      [
        assignee({ username: 'ana' }),
        assignee({ username: 'refinar', kind: 'agent', respondsToMention: true }),
        assignee({ username: 'consultas', kind: 'agent', respondsToMention: false }),
        assignee({
          username: 'mine',
          kind: 'agent',
          respondsToMention: true,
          restrictedToUserId: 'me',
        }),
        assignee({
          username: 'theirs',
          kind: 'agent',
          respondsToMention: true,
          restrictedToUserId: 'someone-else',
        }),
        assignee({ username: null }),
      ],
      'me',
    );

    assert.deepEqual(
      offered.map((c) => c.username),
      ['ana', 'refinar', 'mine'],
    );
  });
});

// The comment box filters the project's assignees with this, as the editors do.
describe('offersMention', () => {
  it('offers people with a handle and the agents that answer mentions', () => {
    assert.equal(offersMention(assignee({ username: 'ana' }), 'me'), true);
    assert.equal(
      offersMention(
        assignee({ username: 'refinar', kind: 'agent', respondsToMention: true }),
        'me',
      ),
      true,
    );
    assert.equal(
      offersMention(
        assignee({ username: 'higiene', kind: 'agent', respondsToMention: false }),
        'me',
      ),
      false,
    );
    assert.equal(offersMention(assignee({ username: null }), 'me'), false);
  });
});
