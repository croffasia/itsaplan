import type { DbExecutor } from '@repo/db';
import { COPY_INCLUDE_KEYS, type CopyIdMaps } from './copy';

export interface CopySectionContext {
  tx: DbExecutor;
  sourceProjectId: number;
  projectId: number;
  ownerId: string;
  // Old → new ids of what the copy re-created before the section runs.
  maps: CopyIdMaps;
  // The copy is a project template.
  template: boolean;
  // The copy stays in the source project's team.
  sameTeam: boolean;
}

// A part of a project an extension of the api adds to a project copy and to a project
// template: the include key that selects it, the keys it needs copied with it, whether a
// template carries it, the copy itself, run inside the copy's transaction, and the names
// of what it holds in a project, which a template's detail lists.
export interface CopySection {
  key: string;
  requires: string[];
  template: boolean;
  copy(context: CopySectionContext): Promise<void>;
  contents(projectId: number): Promise<string[]>;
}

let sections: CopySection[] = [];

// A key the core or another section already uses throws.
export function setCopySections(next: CopySection[] = []): void {
  const taken = new Set<string>(COPY_INCLUDE_KEYS);
  for (const section of next) {
    if (taken.has(section.key)) throw new Error(`Copy section '${section.key}' is taken`);
    taken.add(section.key);
  }
  sections = next;
}

export function copySections(): CopySection[] {
  return sections;
}
