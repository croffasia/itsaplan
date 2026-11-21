import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Assignee, ProjectDetail } from '@/lib/api/endpoints/projects';
import { EMPTY_FILTER_SET } from '@/utils/filters';
import { assignableMembers, buildGroups, newIssueInput, type GroupLabels } from './project';

const me = { kind: 'member', userId: 'me', name: 'Me', canAssign: true } as Assignee;
const activePeer = { kind: 'member', userId: 'peer', name: 'Peer', canAssign: true } as Assignee;
const departed = { kind: 'member', userId: 'ex', name: 'Departed', canAssign: false } as Assignee;
const departedIdle = {
  kind: 'member',
  userId: 'ex-idle',
  name: 'Departed Idle',
  canAssign: false,
} as Assignee;
const agent = { kind: 'agent', userId: 'bot', name: 'Bot', canAssign: true } as Assignee;

const project = {
  columns: [{ id: 10 }, { id: 11 }],
  issueTypes: [
    { id: 1, isDefault: false },
    { id: 2, isDefault: true },
  ],
  plannedCycles: [{ id: 5 }],
  assignees: [me, activePeer, departed, departedIdle, agent],
  issues: [{ id: 1, assigneeUserId: 'ex' }],
} as unknown as ProjectDetail;

const labels: GroupLabels = {
  noAssignee: 'No assignee',
  noDelegate: 'No delegate',
  noPriority: 'No priority',
  noType: 'No type',
  noInitiative: 'No initiative',
  noCycle: 'No cycle',
  noMember: 'Not set',
  priority: (v) => v,
};

describe('assignableMembers', () => {
  it('keeps active members and leaves out deactivated accounts and agents', () => {
    assert.deepEqual(
      assignableMembers(project.assignees).map((a) => a.userId),
      ['me', 'peer'],
    );
  });
});

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

  it('drops a default assignee whose account is deactivated', () => {
    assert.equal(newIssueInput(project, { assigneeUserId: 'ex' }, 'me').assigneeUserId, null);
    assert.equal(newIssueInput(project, { assigneeUserId: 'peer' }, 'me').assigneeUserId, 'peer');
  });

  it('assigns nobody when the user is not a member', () => {
    assert.equal(newIssueInput(project, {}, 'guest').assigneeUserId, null);
    assert.equal(newIssueInput(project, {}, null).assigneeUserId, null);
  });
});

describe('buildGroups by assignee', () => {
  it('keeps a read-only lane for a deactivated member who still holds an issue, and drops one who holds none', () => {
    const groups = buildGroups(project, 'assignee', labels, EMPTY_FILTER_SET);
    assert.deepEqual(
      groups.map((g) => ({ key: g.key, droppable: g.assign !== null })),
      [
        { key: 'ame', droppable: true },
        { key: 'apeer', droppable: true },
        { key: 'aex', droppable: false },
        { key: 'a-none', droppable: true },
      ],
    );
  });
});
