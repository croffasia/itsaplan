import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { dependencyPath, isMilestone } from './timelineDependencies';

describe('dependencyPath', () => {
  it('runs end to start with one turn when the blocked issue starts later', () => {
    assert.equal(
      dependencyPath({ right: 100, midY: 20 }, { left: 160, midY: 60 }),
      'M100,20 H108 V60 H160',
    );
  });

  it('steps back between the rows when the blocked issue starts too early', () => {
    assert.equal(
      dependencyPath({ right: 100, midY: 20 }, { left: 90, midY: 60 }),
      'M100,20 H108 V40 H82 V60 H90',
    );
  });
});

describe('isMilestone', () => {
  const maps = {
    labelById: new Map([
      [1, { id: 1, name: 'Milestone' }],
      [2, { id: 2, name: 'Pharmacy' }],
    ]),
  } as unknown as Parameters<typeof isMilestone>[1];

  it('treats an issue labelled Milestone, in any case, as a milestone', () => {
    assert.equal(isMilestone({ labelIds: [2, 1] }, maps), true);
    assert.equal(isMilestone({ labelIds: [2] }, maps), false);
  });
});
