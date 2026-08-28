import { t } from 'elysia';

export const importIdParams = t.Object({ importId: t.String() });

// The draft the UI renders and confirms against. `mapping` passes through as the
// agent saved it (field -> column header); it is only ever read back, not edited
// from here.
export const ImportResponse = t.Object({
  id: t.String(),
  filename: t.String(),
  contentType: t.String(),
  sizeBytes: t.Number(),
  status: t.Union([
    t.Literal('mapped'),
    t.Literal('confirmed'),
    t.Literal('canceled'),
    t.Literal('failed'),
  ]),
  mapping: t.Any(),
  errorText: t.Nullable(t.String()),
  createdAt: t.String(),
  // The parsed table narrowed to the mapped columns, so the review card can draw
  // every row and the reason confirm would pass it over, without a second round trip.
  // A file exported from a tracker repeats a column per value it holds and runs into
  // the thousands, so the unmapped columns never leave the server.
  preview: t.Optional(
    t.Object({
      columns: t.Array(t.Object({ field: t.String(), header: t.String() })),
      rows: t.Array(t.Object({ cells: t.Array(t.String()), skip: t.Nullable(t.String()) })),
      totalRows: t.Number(),
    }),
  ),
});

export const ConfirmResponse = t.Object({
  imported: t.Array(t.Object({ key: t.String(), title: t.String() })),
  skipped: t.Array(t.Object({ row: t.Number(), reason: t.String() })),
});
