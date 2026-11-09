import type { Assignee } from '@/lib/api/endpoints/projects';
import type {
  CreateImportJobInput,
  LinearTeamOption,
  PlaneConnectionInput,
  PlaneProjectOption,
  TrelloArchivedCards,
  TrelloBoardOption,
  TrelloConnectionInput,
} from '@/lib/api/endpoints/importExport';

// memberMap null: the members are not matched, and no card gets an assignee.
export interface TrelloImportChoices {
  archivedCards: TrelloArchivedCards;
  memberMap: Record<string, string> | null;
}

// What is about to be imported: one Plane project, one Linear team's project
// (projectId) or its issues with no project (projectId null), or one Trello board
// with the project members its members can be matched with.
export type ImportReviewTarget =
  | { source: 'plane'; connection: PlaneConnectionInput; project: PlaneProjectOption }
  | { source: 'linear'; apiToken: string; team: LinearTeamOption; projectId: string | null }
  | {
      source: 'trello';
      connection: TrelloConnectionInput;
      board: TrelloBoardOption;
      people: Assignee[];
    };

// The source fields of the job a review starts. `trello` is read for a Trello target only.
export function importJobFields(
  target: ImportReviewTarget,
  trello: TrelloImportChoices,
): CreateImportJobInput {
  if (target.source === 'plane') {
    return {
      source: 'plane',
      baseUrl: target.connection.baseUrl,
      workspaceSlug: target.connection.workspaceSlug,
      apiToken: target.connection.apiToken,
      planeProjectId: target.project.id,
      planeProjectKey: target.project.identifier,
    };
  }
  if (target.source === 'trello') {
    return {
      source: 'trello',
      ...target.connection,
      boardId: target.board.id,
      archivedCards: trello.archivedCards,
      ...(trello.memberMap ? { memberMap: trello.memberMap } : {}),
    };
  }
  const team = { apiToken: target.apiToken, teamId: target.team.id, teamKey: target.team.key };
  return target.projectId
    ? { source: 'linear', ...team, projectFilter: 'project', projectId: target.projectId }
    : { source: 'linear', ...team, projectFilter: 'none' };
}
