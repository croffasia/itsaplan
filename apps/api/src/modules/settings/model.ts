import { t } from 'elysia';

export const StorageSettingsSchema = t.Object({
  maxAttachmentMb: t.Number(),
  maxAvatarMb: t.Number(),
  attachmentMimeTypes: t.Array(t.String()),
  projectQuotaMb: t.Number(),
});

export const ProjectDefaultsSchema = t.Object({
  mcpEnabled: t.Boolean(),
});

// A command id bound to a combination written as modifier tokens plus a key
// ('mod+k', 'n'). The set of commands lives in the web app (its lib/hotkeys), so
// the API checks the shape and stores the map as given.
export const HotkeyCombosSchema = t.Record(
  t.String({ pattern: '^[a-z][a-z0-9.-]{0,63}$' }),
  t.String({ pattern: '^(mod\\+|shift\\+|alt\\+)*[a-z0-9]{1,10}$' }),
);

const ReleaseSchema = t.Object({
  tag: t.String(),
  version: t.String(),
  publishedAt: t.String(),
  url: t.Nullable(t.String()),
  notes: t.String(),
  notesFormat: t.UnionEnum(['html', 'markdown']),
});

export const UpdateStatusSchema = t.Object({
  currentVersion: t.String(),
  latestVersion: t.Nullable(t.String()),
  updateAvailable: t.Boolean(),
  checkedAt: t.Nullable(t.String()),
  releases: t.Array(ReleaseSchema),
});

export const VersionResponse = t.Object({ version: t.String() });
