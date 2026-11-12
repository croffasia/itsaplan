import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import { newIssueInput } from './project';

const project = {
  columns: [{ id: 10 }, { id: 11 }],
  issueTypes: [
    { id: 1, isDefault: false },
    { id: 2, isDefault: true },
  ],
  plannedCycles: [{ id: 5 }],
  assignees: [{ kind: 'member', userId: 'me' }],
} as unknown as ProjectDetail;

describe('newIssueInput', () => {
  it('fills what the defaults leave out', () => {
    const input = newIssueInput(project, { title: 'A' }, 'me');
    assert.equal(input.columnId, 10);
    assert.equal(input.typeId, 2);
    assert.equal(input.assigneeUserId, 'me');
    assert.equal(input.cycleId, null);
  });

  it('keeps an explicit "none" and drops a cycle that is not planned', () => {
    const input = newIssueInput(project, { typeId: null, assigneeUserId: null, cycleId: 9 }, 'me');
    assert.equal(input.typeId, null);
    assert.equal(input.assigneeUserId, null);
    assert.equal(input.cycleId, null);
    assert.equal(newIssueInput(project, { cycleId: 5 }, 'me').cycleId, 5);
  });

  it('assigns nobody when the user is not a member', () => {
    assert.equal(newIssueInput(project, {}, 'guest').assigneeUserId, null);
    assert.equal(newIssueInput(project, {}, null).assigneeUserId, null);
  });
});
