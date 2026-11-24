import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ActionDef } from '@/lib/api/endpoints/actions';
import type { Issue } from '@/lib/api/endpoints/issues';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import { availableActionEffect, describeEffect, matchedActions } from './actions';

const project = {
  assignees: [
    { userId: 'active', name: 'Active', canAssign: true },
    { userId: 'departed', name: 'Departed', canAssign: false },
  ],
  columns: [{ id: 2, name: 'Done', autoAssignUserId: 'active' }],
  labels: [{ id: 3, name: 'Review' }],
} as ProjectDetail;

function issue(assigneeUserId: string | null, columnId = 1): Issue {
  return { assigneeUserId, columnId } as Issue;
}

function action(id: number, effect: ActionDef['effect']): ActionDef {
  return {
    id,
    projectId: 1,
    name: 'Action',
    icon: '',
    condition: { conditions: [] },
    effect,
    position: id,
    createdAt: '',
  };
}

describe('saved action preview', () => {
  it('offers a mixed action, and describes only the remaining changes', () => {
    const mixed = action(1, {
      assigneeUserId: 'departed',
      columnId: 2,
      priority: 'high',
      labelIds: [3],
    });
    const assignDeparted = action(2, { assigneeUserId: 'departed' });
    const unassigned = issue(null);
    assert.deepEqual(matchedActions([mixed, assignDeparted], project, unassigned), [mixed]);

    const effect = availableActionEffect(mixed.effect, project, unassigned);
    const lines = describeEffect(effect, project, {
      field: (key) => key,
      priority: (value) => value ?? '',
      cleared: 'Cleared',
      noAssignee: 'No assignee',
      noType: 'No type',
      noLabels: 'No labels',
    });
    assert.deepEqual(
      lines.map((line) => line.key),
      ['columnId', 'priority', 'labelIds'],
    );
    assert.equal(mixed.effect.assigneeUserId, 'departed');
  });

  it('offers assignment-only actions when they change the assignee', () => {
    const assign = action(1, { assigneeUserId: 'active' });
    const clear = action(2, { assigneeUserId: null });
    const mixed = action(3, { assigneeUserId: 'active', priority: 'high' });
    const actions = [assign, clear, mixed];
    assert.deepEqual(matchedActions(actions, project, issue(null)), [assign, mixed]);
    assert.deepEqual(matchedActions(actions, project, issue('active')), [clear, mixed]);
    assert.deepEqual(matchedActions(actions, project, issue('departed')), [assign, clear, mixed]);
  });

  it('previews column auto-assignment for a move without an explicit assignment', () => {
    const move = { columnId: 2 };
    assert.deepEqual(availableActionEffect(move, project, issue(null)), {
      columnId: 2,
      assigneeUserId: 'active',
    });
    assert.deepEqual(availableActionEffect(move, project, issue(null, 2)), move);
    const clear = { ...move, assigneeUserId: null };
    assert.deepEqual(availableActionEffect(clear, project, issue('active')), clear);
  });
});
