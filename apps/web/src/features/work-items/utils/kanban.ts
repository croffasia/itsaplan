import { preferPrefix } from './dnd';

// Width of one board column, shared by the flat board and the swimlane grid so
// the column header row lines up with the cells below it.
export const COLUMN_WIDTH = 313;

export const boardCollision = preferPrefix('card:');

// Collapsed swimlanes are a per-project, per-swimlane-field client-only preference,
// persisted in localStorage so it survives reloads without touching the server.
export function collapsedSwimlanesKey(projectId: number, subgroup: string): string {
  return `kanban-swimlanes-collapsed:${projectId}:${subgroup}`;
}
