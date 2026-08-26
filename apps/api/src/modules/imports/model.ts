import { t } from 'elysia';

export { projectKeyParams } from '../issues/model';

export const importIdParams = t.Object({ importId: t.String() });

export const uploadImportBody = t.Object({ file: t.File() });

// The draft the UI renders and confirms against. `mapping` passes through as the
// agent saved it (field -> column header); it is only ever read back, not edited
// from here.
export const ImportResponse = t.Object({
  id: t.String(),
  filename: t.String(),
  contentType: t.String(),
  sizeBytes: t.Number(),
  status: t.Union([
    t.Literal('pending'),
    t.Literal('mapped'),
    t.Literal('confirmed'),
    t.Literal('canceled'),
    t.Literal('failed'),
  ]),
  mapping: t.Any(),
  errorText: t.Nullable(t.String()),
  createdAt: t.String(),
  // The head of the parsed table, so the review card can draw real rows without
  // a second round trip.
  preview: t.Optional(
    t.Object({
      headers: t.Array(t.String()),
      rows: t.Array(t.Array(t.String())),
      totalRows: t.Number(),
    }),
  ),
});

export const ConfirmResponse = t.Object({
  imported: t.Array(t.Object({ key: t.String(), title: t.String() })),
  skipped: t.Array(t.Object({ row: t.Number(), reason: t.String() })),
});
