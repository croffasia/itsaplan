import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Project } from '@/lib/api/endpoints/projects';
import type { Team } from '@/lib/api/endpoints/teams';
import { groupProjects, projectSwitcherSections, type ProjectSort } from './projectSwitcher';

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: 1,
    teamId: 1,
    teamName: 'Engineering',
    key: 'API',
    name: 'API platform',
    description: '',
    mcpEnabled: true,
    teamMcpEnabled: true,
    initiativesEnabled: true,
    dashboardsEnabled: true,
    documentsEnabled: true,
    notesEnabled: true,
    cyclesEnabled: true,
    subtasksEnabled: true,
    checklistsEnabled: true,
    issueStatsEnabled: true,
    availableFeatures: [],
    pointsEstimateEnabled: false,
    timeEstimateEnabled: false,
    timeLoggingEnabled: false,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function team(overrides: Partial<Team> = {}): Team {
  return {
    id: 1,
    name: 'Engineering',
    mcpEnabled: true,
    role: 'owner',
    source: 'invite',
    joinedAt: '2026-01-01T00:00:00Z',
    projectCount: 1,
    memberCount: 1,
    ownerCount: 1,
    roleCount: 0,
    integrationCount: 0,
    agentCount: 0,
    skillCount: 0,
    toolCount: 0,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('groupProjects', () => {
  it('preserves team order, empty teams, and projects outside the supplied teams', () => {
    const groups = groupProjects(
      [project(), project({ id: 2, key: 'EXT', teamId: 3, teamName: 'External' })],
      [team({ id: 2, name: 'Empty' }), team()],
      '  ',
      'key',
      'en',
    );
    assert.deepEqual(
      groups.map((group) => [group.teamName, group.projects.length]),
      [
        ['Empty', 0],
        ['Engineering', 1],
        ['External', 1],
      ],
    );
  });

  it('matches all query tokens across project name, key, and current team name', () => {
    const projects = [project({ name: 'Client platform' }), project({ id: 2, key: 'WEB' })];
    const teams = [team({ name: 'Product' })];
    assert.deepEqual(
      groupProjects(projects, teams, '  PRODUCT\tapi  client ', 'key', 'en')[0]?.projects,
      [projects[0]],
    );
    assert.deepEqual(groupProjects(projects, teams, 'api missing', 'key', 'en'), []);
  });

  it('ignores accents and case while retaining non-Latin project names', () => {
    const accented = project({ name: 'Équipe München' });
    const japanese = project({ id: 2, key: 'JP', name: '日本語プロジェクト' });
    assert.deepEqual(
      groupProjects([accented, japanese], [], 'EQUIPE munchen', 'key', 'en')[0]?.projects,
      [accented],
    );
    assert.deepEqual(groupProjects([accented, japanese], [], '日本語', 'key', 'ja')[0]?.projects, [
      japanese,
    ]);
  });

  it('finds every project in a matching team and retains matching empty teams', () => {
    const projects = [project(), project({ id: 2, key: 'WEB' })];
    const teams = [team(), team({ id: 2, name: 'Engineering support' })];
    const groups = groupProjects(projects, teams, 'engineering', 'key', 'en');
    assert.deepEqual(
      groups.map((group) => group.projects.length),
      [2, 0],
    );
    assert.deepEqual(groupProjects(projects, teams, 'support', 'key', 'en'), [
      { teamId: 2, teamName: 'Engineering support', projects: [] },
    ]);
  });

  it('sorts by key or locale-aware name with a stable key tie break', () => {
    const projects = [
      project({ id: 3, key: 'Z', name: 'Alpha' }),
      project({ id: 1, key: 'A', name: 'Zulu' }),
      project({ id: 2, key: 'B', name: 'Alpha' }),
    ];
    assert.deepEqual(
      groupProjects(projects, [], '', 'key', 'en')[0]?.projects.map((item) => item.key),
      ['A', 'B', 'Z'],
    );
    assert.deepEqual(
      groupProjects(projects, [], '', 'name', 'en')[0]?.projects.map((item) => item.key),
      ['B', 'Z', 'A'],
    );
    assert.deepEqual(
      groupProjects(
        [project({ key: 'A', name: 'Äpple' }), project({ key: 'Z', name: 'Zebra' })],
        [],
        '',
        'name',
        'sv',
      )[0]?.projects.map((item) => item.key),
      ['Z', 'A'],
    );
  });

  it('sorts by creation date, including groups, with empty teams last', () => {
    const projects = [
      project({ key: 'OLD' }),
      project({ id: 2, key: 'NEW', createdAt: '2026-09-01T00:00:00Z' }),
      project({ id: 3, key: 'LATEST', teamId: 2, createdAt: '2026-09-09T00:00:00Z' }),
    ];
    const groups = groupProjects(
      projects,
      [team({ id: 3, name: 'Empty' }), team(), team({ id: 2, name: 'Recent' })],
      '',
      'created',
      'en',
    );
    assert.deepEqual(
      groups.map((group) => group.teamId),
      [2, 1, 3],
    );
    assert.deepEqual(
      groups[1]?.projects.map((item) => item.key),
      ['NEW', 'OLD'],
    );
  });

  it('sorts null or absent activity last regardless of creation date', () => {
    const projects = [
      project({ key: 'ABSENT', createdAt: '2026-09-20T00:00:00Z' }),
      project({ id: 2, key: 'NULL', createdAt: '2026-09-21T00:00:00Z', lastActivityAt: null }),
      project({ id: 3, key: 'ACTIVE', lastActivityAt: '2026-09-09T00:00:00Z' }),
      project({ id: 4, key: 'TIE', lastActivityAt: '2026-09-09T00:00:00Z' }),
      project({ id: 5, key: 'TEAM2', teamId: 2, lastActivityAt: '2026-09-10T00:00:00Z' }),
    ];
    const groups = groupProjects(projects, [team(), team({ id: 2 })], '', 'activity', 'en');
    assert.deepEqual(
      groups.map((group) => group.teamId),
      [2, 1],
    );
    assert.deepEqual(
      groups[1]?.projects.map((item) => item.key),
      ['ACTIVE', 'TIE', 'ABSENT', 'NULL'],
    );
  });

  it('keeps favorites first while sorting favorites and other projects by the selected order', () => {
    const projects = [
      project({
        key: 'A',
        name: 'Alpha',
        createdAt: '2026-09-10T00:00:00Z',
        lastActivityAt: '2026-09-10T00:00:00Z',
      }),
      project({
        id: 2,
        key: 'Z',
        name: 'Zulu',
        isFavorite: true,
        createdAt: '2026-09-09T00:00:00Z',
        lastActivityAt: '2026-09-09T00:00:00Z',
      }),
      project({
        id: 3,
        key: 'B',
        name: 'Beta',
        isFavorite: true,
        createdAt: '2026-09-08T00:00:00Z',
        lastActivityAt: '2026-09-08T00:00:00Z',
      }),
    ];
    for (const sort of ['key', 'name', 'created', 'activity'] as ProjectSort[]) {
      const expected = sort === 'key' || sort === 'name' ? ['B', 'Z', 'A'] : ['Z', 'B', 'A'];
      assert.deepEqual(
        groupProjects(projects, [], '', sort, 'en')[0]?.projects.map((item) => item.key),
        expected,
      );
    }
  });

  it('puts teams containing favorites first and ranks them using their newest project', () => {
    const projects = [
      project({ key: 'UNSTARRED', lastActivityAt: '2026-09-12T00:00:00Z' }),
      project({ id: 2, key: 'STARRED', teamId: 2, isFavorite: true, lastActivityAt: null }),
      project({ id: 3, key: 'RECENT', teamId: 2, lastActivityAt: '2026-09-10T00:00:00Z' }),
      project({
        id: 4,
        key: 'OTHER',
        teamId: 3,
        isFavorite: true,
        lastActivityAt: '2026-09-09T00:00:00Z',
      }),
    ];
    const teams = [team(), team({ id: 3 }), team({ id: 2 })];
    assert.deepEqual(
      groupProjects(projects, teams, '', 'key', 'en').map((group) => group.teamId),
      [3, 2, 1],
    );
    const activityGroups = groupProjects(projects, teams, '', 'activity', 'en');
    assert.deepEqual(
      activityGroups.map((group) => group.teamId),
      [2, 3, 1],
    );
    assert.deepEqual(
      activityGroups[0]?.projects.map((item) => item.key),
      ['STARRED', 'RECENT'],
    );
  });

  it('keeps supplied hidden projects available for the caller to control visibility', () => {
    const hidden = project({ isHidden: true });
    assert.deepEqual(groupProjects([hidden], [], '', 'key', 'en')[0]?.projects, [hidden]);
  });

  it('does not mutate project objects, arrays, or team input', () => {
    const projects = [project({ key: 'Z' }), project({ id: 2, key: 'A' })];
    const teams = [team({ id: 2, name: 'Empty' }), team()];
    const original = structuredClone({ projects, teams });
    for (const item of [...projects, ...teams]) Object.freeze(item);
    Object.freeze(projects);
    Object.freeze(teams);
    groupProjects(projects, teams, '', 'created', 'en');
    assert.deepEqual({ projects, teams }, original);
  });
});

describe('projectSwitcherSections', () => {
  it('separates hidden favorites without changing visible team order or removing empty teams', () => {
    const visible = project();
    const hidden = project({ id: 2, teamId: 2, key: 'HIDDEN', isHidden: true, isFavorite: true });
    const sections = projectSwitcherSections(
      [hidden, visible],
      [team(), team({ id: 2, name: 'Hidden team' }), team({ id: 3, name: 'Empty' })],
      '',
      'key',
      'en',
    );
    assert.deepEqual(
      sections.visibleGroups.map((group) => group.teamId),
      [1, 2, 3],
    );
    assert.deepEqual(
      sections.visibleGroups.flatMap((group) => group.projects),
      [visible],
    );
    assert.deepEqual(sections.hiddenProjects, [hidden]);
  });

  it('keeps results for hidden project searches exclusively in the hidden section', () => {
    const hidden = project({ id: 2, key: 'ARCHIVE', name: 'Archived launch', isHidden: true });
    const sections = projectSwitcherSections(
      [project(), hidden],
      [team()],
      'archived launch',
      'name',
      'en',
    );
    assert.deepEqual(sections.visibleGroups, []);
    assert.deepEqual(sections.hiddenProjects, [hidden]);
  });

  it('places a restored project in the visible section and removes it from hidden projects', () => {
    const hidden = project({ isHidden: true });
    const restored = { ...hidden, isHidden: false };
    const before = projectSwitcherSections([hidden], [team()], '', 'key', 'en');
    const after = projectSwitcherSections([restored], [team()], '', 'key', 'en');
    assert.deepEqual(before.hiddenProjects, [hidden]);
    assert.deepEqual(
      before.visibleGroups.flatMap((group) => group.projects),
      [],
    );
    assert.deepEqual(after.hiddenProjects, []);
    assert.deepEqual(
      after.visibleGroups.flatMap((group) => group.projects),
      [restored],
    );
    assert.equal(hidden.isHidden, true);
  });

  it('sorts hidden projects using the selected preference without affecting visible activity', () => {
    const projects = [
      project({ key: 'VISIBLE', lastActivityAt: '2026-09-09T00:00:00Z' }),
      project({ id: 2, teamId: 2, key: 'OTHER', lastActivityAt: '2026-09-08T00:00:00Z' }),
      project({
        id: 3,
        teamId: 2,
        key: 'OLDER',
        isHidden: true,
        lastActivityAt: '2026-09-10T00:00:00Z',
      }),
      project({
        id: 4,
        teamId: 2,
        key: 'NEWER',
        isHidden: true,
        lastActivityAt: '2026-09-11T00:00:00Z',
      }),
    ];
    const sections = projectSwitcherSections(
      projects,
      [team(), team({ id: 2 })],
      '',
      'activity',
      'en',
    );
    assert.deepEqual(
      sections.visibleGroups.map((group) => group.teamId),
      [1, 2],
    );
    assert.deepEqual(
      sections.hiddenProjects.map((item) => item.key),
      ['NEWER', 'OLDER'],
    );
  });
});
