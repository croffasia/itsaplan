import { t } from 'elysia';

export const webhookParams = t.Object({ webhookId: t.String() });

export const webhookBody = t.String();

export const WebhookAckResponse = t.Object({ ok: t.Boolean(), handled: t.String() });

// The repository integration DTO (GitSettings from the service). Unlike outgoing
// webhook secrets, this secret authorizes issue moves through the receiver, so
// it is shown only to members with integrations edit access; read-only callers
// get null.
export const GitSettingsResponse = t.Object({
  enabled: t.Boolean(),
  webhookId: t.String(),
  secret: t.Nullable(t.String()),
  onMergeColumnId: t.Nullable(t.Number()),
  onOpenColumnId: t.Nullable(t.Number()),
  repositories: t.Array(
    t.Object({ repo: t.String(), provider: t.String(), lastEventAt: t.String() }),
  ),
});

export const updateGitSettingsBody = t.Object({
  enabled: t.Optional(t.Boolean()),
  onMergeColumnId: t.Optional(t.Nullable(t.Number())),
  onOpenColumnId: t.Optional(t.Nullable(t.Number())),
});
