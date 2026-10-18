import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import {
  MSPROJECT_STATES,
  MspdiParseError,
  mapMsProjectLabels,
  mapMsProjectRelations,
  mapMsProjectTask,
  msprojectPriority,
  msprojectStateId,
  parseMspdi,
} from '../../msproject-mapping';
import { MsProjectReader } from '../../msproject-adapter';

const xml = readFileSync(new URL('./fixtures/plan.xml', import.meta.url), 'utf8');
const plan = parseMspdi(xml);
const task = (uid: string) => plan.tasks.find((t) => t.uid === uid)!;

describe('parseMspdi', () => {
  it('skips the project summary task and unnamed tasks', () => {
    expect(plan.tasks.map((t) => t.uid)).toEqual(['1', '2', '3', '5']);
  });

  it('decodes entities in names and notes', () => {
    expect(task('1').name).toBe('Design & permits');
    expect(task('2').notes).toBe('Use the <final> survey.');
  });

  it('makes summary tasks the parents of their subtasks', () => {
    expect(plan.parents.get('2')).toBe('1');
    expect(plan.parents.get('3')).toBe('1');
    expect(plan.parents.has('1')).toBe(false);
    expect(plan.parents.has('5')).toBe(false);
  });

  it('takes the first assigned resource that has an email', () => {
    expect(plan.assignees.get('2')).toBe('dana@example.com');
    expect(plan.assignees.has('5')).toBe(false);
  });

  it('refuses a DOCTYPE, other XML and non-XML', () => {
    const doctype = '<!DOCTYPE p [<!ENTITY x "y">]><Project><Tasks/></Project>';
    expect(() => parseMspdi(doctype)).toThrow(MspdiParseError);
    expect(() => parseMspdi('<Other/>')).toThrow(MspdiParseError);
    expect(() => parseMspdi('')).toThrow(MspdiParseError);
  });
});

describe('mapMsProjectTask', () => {
  it('maps a finished subtask', () => {
    expect(mapMsProjectTask(task('2'), plan)).toEqual({
      sourceId: '2',
      sequenceId: 2,
      title: 'Draw plans',
      descriptionMarkdown: 'Use the <final> survey.',
      stateSourceId: 'done',
      assigneeEmail: 'dana@example.com',
      labelSourceIds: [],
      cycleSourceId: null,
      parentSourceId: '1',
      priority: 'high',
      startDate: '2025-01-06',
      dueDate: '2025-01-17',
      customFields: [],
      createdAt: '2025-01-03T09:00:00.000Z',
      updatedAt: '2025-01-03T09:00:00.000Z',
    });
  });

  it('labels a milestone and falls back to the project creation date', () => {
    const issue = mapMsProjectTask(task('3'), plan);
    expect(issue.labelSourceIds).toEqual(['milestone']);
    expect(issue.priority).toBe('urgent');
    expect(issue.createdAt).toBe('2025-01-02T08:00:00.000Z');
    expect(mapMsProjectLabels(plan)).toEqual([{ sourceId: 'milestone', name: 'Milestone' }]);
  });

  it('buckets percent complete and priority', () => {
    expect([0, 1, 99, 100].map(msprojectStateId)).toEqual([
      'todo',
      'in-progress',
      'in-progress',
      'done',
    ]);
    expect([0, 299, 300, 500, 700, 899, 900, 1000].map(msprojectPriority)).toEqual([
      'low',
      'low',
      'medium',
      'medium',
      'high',
      'high',
      'urgent',
      'urgent',
    ]);
    expect(MSPROJECT_STATES.map((s) => s.category)).toEqual(['unstarted', 'started', 'completed']);
  });
});

describe('mapMsProjectRelations', () => {
  it('makes each predecessor block its successor and drops unknown ones', () => {
    expect(mapMsProjectRelations(task('5'), plan)).toEqual([
      { kind: 'blocks', sourceIssueSourceId: '3', targetIssueSourceId: '5' },
    ]);
    expect(mapMsProjectRelations(task('1'), plan)).toEqual([]);
  });
});

describe('MsProjectReader', () => {
  it('reads the file once and pages the tasks', async () => {
    let reads = 0;
    const reader = new MsProjectReader('k.xml', async () => {
      reads++;
      return xml;
    });
    const page = await reader.listIssues(null);
    expect(page.items).toHaveLength(4);
    expect(page.cursor).toBeNull();
    expect((await reader.getIssue('5')).title).toBe('Build');
    expect(await reader.listIssueRelations('5')).toHaveLength(1);
    expect(await reader.listIssueComments()).toEqual([]);
    expect(reads).toBe(1);
  });

  it('pages 100 tasks at a time', async () => {
    const tasks = Array.from(
      { length: 150 },
      (_, i) => `<Task><UID>${i + 1}</UID><Name>T${i}</Name></Task>`,
    );
    const big = `<Project xmlns="http://schemas.microsoft.com/project"><Tasks>${tasks.join('')}</Tasks></Project>`;
    const reader = new MsProjectReader('k.xml', async () => big);
    const first = await reader.listIssues(null);
    expect(first.items).toHaveLength(100);
    expect(first.cursor).toBe('100');
    const second = await reader.listIssues(first.cursor);
    expect(second.items).toHaveLength(50);
    expect(second.cursor).toBeNull();
  });
});
