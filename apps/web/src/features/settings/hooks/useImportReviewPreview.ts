import type { UseQueryResult } from '@tanstack/react-query';
import type { PlaneStateOption, TrelloMemberOption } from '@/lib/api/endpoints/importExport';
import {
  useTestLinearStatesPreview,
  useTestPlaneStatesPreview,
  useTrelloBoardPreview,
} from '../services/settings.service';
import type { ImportReviewTarget } from '../utils/importJobFields';

export interface ImportReviewPreview {
  states: PlaneStateOption[];
  // A Trello board's members; absent for the other sources.
  members?: TrelloMemberOption[];
}

// The preview of the review's target. Every source's query is declared and only the
// target's one runs.
export function useImportReviewPreview(
  projectKey: string,
  target: ImportReviewTarget,
): UseQueryResult<ImportReviewPreview> {
  const plane = useTestPlaneStatesPreview(
    projectKey,
    target.source === 'plane'
      ? {
          baseUrl: target.connection.baseUrl,
          workspaceSlug: target.connection.workspaceSlug,
          apiToken: target.connection.apiToken,
          planeProjectId: target.project.id,
        }
      : null,
  );
  const linear = useTestLinearStatesPreview(
    projectKey,
    target.source === 'linear' ? { apiToken: target.apiToken, teamId: target.team.id } : null,
  );
  const trello = useTrelloBoardPreview(
    projectKey,
    target.source === 'trello' ? { ...target.connection, boardId: target.board.id } : null,
  );
  if (target.source === 'trello') return trello;
  return target.source === 'plane' ? plane : linear;
}
