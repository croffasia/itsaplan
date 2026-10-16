import { t } from 'elysia';
import { PROJECT_FEATURES } from '#shared/features';

const id = t.Integer({ minimum: 1, maximum: 2147483647 });
export const previewProjectTransferBody = t.Object({ targetTeamId: id });
export const transferProjectBody = t.Object({
  projectId: id,
  sourceTeamId: id,
  targetTeamId: id,
  roleMappings: t.Optional(
    t.Array(
      t.Object({
        sourceRoleId: id,
        targetRoleId: t.Nullable(id, {
          description: 'Destination role ID, or null to use its default role.',
        }),
      }),
    ),
  ),
});
export type TransferProjectInput = typeof transferProjectBody.static;

export const ProjectTransferPreviewResponse = t.Object({
  projectId: id,
  sourceTeamId: id,
  targetTeamId: id,
  targetRef: t.String(),
  memberCount: t.Integer(),
  canTransfer: t.Boolean(),
  blockers: t.Array(t.Object({ code: t.String(), message: t.String() })),
  requiredRoles: t.Array(
    t.Object({ sourceRoleId: id, name: t.String(), memberCount: t.Integer() }),
  ),
  targetDefaultRoleId: t.Nullable(id),
  targetAvailableFeatures: t.Array(t.UnionEnum([...PROJECT_FEATURES])),
  notificationProvidersChange: t.Boolean(),
});
export type ProjectTransferPreview = typeof ProjectTransferPreviewResponse.static;
