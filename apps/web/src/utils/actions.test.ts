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
  columns: [{ id: 2, name: 'Done' }],
  labels: [{ id: 3, name: 'Review' }],
} as ProjectDetail;

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
    assert.deepEqual(matchedActions([mixed, assignDeparted], project, {} as Issue), [mixed]);

    const effect = availableActionEffect(mixed.effect, project);
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

  it('offers an active assignee or explicit unassignment', () => {
    const assign = action(1, { assigneeUserId: 'active' });
    const clear = action(2, { assigneeUserId: null });
    assert.deepEqual(matchedActions([assign, clear], project, {} as Issue), [assign, clear]);
    assert.deepEqual(availableActionEffect(assign.effect, project), { assigneeUserId: 'active' });
    assert.deepEqual(availableActionEffect(clear.effect, project), { assigneeUserId: null });
  });
});
