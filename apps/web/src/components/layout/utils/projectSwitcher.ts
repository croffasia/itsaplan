import type { Project } from '@/lib/api/endpoints/projects';
import type { Team } from '@/lib/api/endpoints/teams';

export type ProjectSort = 'key' | 'name' | 'created' | 'activity';

export interface TeamGroup {
  teamId: number;
  teamName: string;
  projects: Project[];
}

function normalizeSearch(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

function projectTimestamp(project: Project, sort: ProjectSort): number {
  const value = sort === 'activity' ? project.lastActivityAt : project.createdAt;
  if (!value) return -Infinity;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : -Infinity;
}

export function groupProjects(
  projects: Project[],
  teams: Team[],
  query: string,
  sort: ProjectSort,
  locale: string,
): TeamGroup[] {
  const groups = new Map<number, TeamGroup>(
    teams.map((team) => [team.id, { teamId: team.id, teamName: team.name, projects: [] }]),
  );
  const tokens = normalizeSearch(query).split(/\s+/).filter(Boolean);
  const matches = (value: string) => {
    const normalized = normalizeSearch(value);
    return tokens.every((token) => normalized.includes(token));
  };

  for (const project of projects) {
    let group = groups.get(project.teamId);
    if (!group) {
      group = { teamId: project.teamId, teamName: project.teamName, projects: [] };
      groups.set(project.teamId, group);
    }
    if (matches(`${project.name} ${project.key} ${group.teamName}`)) {
      group.projects.push(project);
    }
  }

  const collator = new Intl.Collator(locale, { sensitivity: 'base' });
  const compareKeys = (a: Project, b: Project) => {
    const order = collator.compare(a.key, b.key);
    if (order) return order;
    if (a.key !== b.key) return a.key < b.key ? -1 : 1;
    return a.id - b.id;
  };
  const result = [...groups.values()].filter(
    (group) => group.projects.length > 0 || matches(group.teamName),
  );

  for (const group of result) {
    group.projects.sort((a, b) => {
      const favoriteOrder = Number(Boolean(b.isFavorite)) - Number(Boolean(a.isFavorite));
      if (favoriteOrder) return favoriteOrder;
      let order = 0;
      if (sort === 'name') order = collator.compare(a.name, b.name);
      if (sort === 'created' || sort === 'activity') {
        order = projectTimestamp(b, sort) - projectTimestamp(a, sort);
      }
      return order || compareKeys(a, b);
    });
  }

  const newest = (group: TeamGroup) =>
    group.projects.reduce(
      (latest, project) => Math.max(latest, projectTimestamp(project, sort)),
      -Infinity,
    );
  result.sort((a, b) => {
    const favoriteOrder =
      Number(b.projects.some((project) => project.isFavorite)) -
      Number(a.projects.some((project) => project.isFavorite));
    if (favoriteOrder) return favoriteOrder;
    if (sort === 'created' || sort === 'activity') return newest(b) - newest(a) || 0;
    return 0;
  });
  return result;
}

export function projectSwitcherSections(
  projects: Project[],
  teams: Team[],
  query: string,
  sort: ProjectSort,
  locale: string,
): { visibleGroups: TeamGroup[]; hiddenProjects: Project[] } {
  const visible = projects.filter((project) => !project.isHidden);
  const hidden = projects.filter((project) => project.isHidden);
  return {
    visibleGroups: groupProjects(visible, teams, query, sort, locale),
    hiddenProjects: groupProjects(hidden, teams, query, sort, locale).flatMap(
      (group) => group.projects,
    ),
  };
}
