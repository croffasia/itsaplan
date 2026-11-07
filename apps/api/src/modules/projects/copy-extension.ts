import type { DbExecutor } from '@repo/db';
import { COPY_INCLUDE_KEYS, type CopyIdMaps } from './copy';

export interface CopySectionContext {
  tx: DbExecutor;
  projectId: number;
  ownerId: string;
  // Old → new ids of what the snapshot re-created before the section runs.
  maps: CopyIdMaps;
  // The new project is in the team of the project the snapshot was read from. Always
  // false for a project template, which belongs to the workspace.
  sameTeam: boolean;
}

// A part of a project an extension of the api adds to a project copy and to a project
// template: the include key that selects it, the keys it needs copied with it, whether a
// template carries it, what it holds in a project (stored in the snapshot as JSON), how
// that is written into a new project inside the transaction that creates it, and the names of
// what it holds, which a template's detail lists.
export interface CopySection {
  key: string;
  requires: string[];
  template: boolean;
  read(projectId: number): Promise<unknown>;
  apply(context: CopySectionContext, data: unknown): Promise<void>;
  contents(data: unknown): string[];
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
