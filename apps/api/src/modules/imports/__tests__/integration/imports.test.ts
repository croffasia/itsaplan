import { describe, it, expect, beforeEach } from 'bun:test';
import ExcelJS from 'exceljs';
import { authedApi } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { saveMapping } from '../../service';

// The import flow: an upload stores the file and a pending row, an agent saves a
// column mapping through the service (the tools call it in process), and the
// confirm route creates the issues. Needs MinIO like the attachments suite.

async function setup() {
  const owner = await signUpTestUser();
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  return { asOwner };
}

async function uploadWorkbook(
  client: ReturnType<typeof authedApi>,
  rows: string[][],
  name = 'tasks.xlsx',
) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Tasks');
  for (const row of rows) sheet.addRow(row);
  const bytes = Buffer.from(await workbook.xlsx.writeBuffer());
  return client.projects({ projectKey: 'MKT' }).imports.post({
    file: new File([bytes], name, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
  });
}

describe('imports', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('uploads a workbook as a pending draft', async () => {
    const { asOwner } = await setup();
    const res = await uploadWorkbook(asOwner, [
      ['Task', 'Notes'],
      ['First', 'hello'],
    ]);
    expect(res.status).toBe(201);
    expect(res.data).toMatchObject({ filename: 'tasks.xlsx', status: 'pending', mapping: null });
  });

  it('rejects unsupported extensions and empty files', async () => {
    const { asOwner } = await setup();
    const wrongType = await asOwner.projects({ projectKey: 'MKT' }).imports.post({
      file: new File(['x'], 'notes.txt', { type: 'text/plain' }),
    });
    expect(wrongType.status).toBe(400);

    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('Empty');
    const bytes = Buffer.from(await workbook.xlsx.writeBuffer());
    const empty = await asOwner.projects({ projectKey: 'MKT' }).imports.post({
      file: new File([bytes], 'empty.xlsx', { type: 'application/octet-stream' }),
    });
    // Parsing happens on read, so an unsheeted-but-valid upload is accepted here
    // and fails when the agent reads it; an empty body is refused outright.
    expect(empty.status).toBe(201);
    const zero = await asOwner.projects({ projectKey: 'MKT' }).imports.post({
      file: new File([], 'zero.xlsx', { type: 'application/octet-stream' }),
    });
    expect(zero.status).toBe(400);
  });

  it('denies a non-member uploading', async () => {
    await setup();
    const outsider = authedApi((await signUpTestUser()).cookie);
    const res = await uploadWorkbook(outsider, [['Task']]);
    expect(res.status).toBe(403);
  });

  it('maps, confirms, and creates the issues; skips unmappable rows', async () => {
    const { asOwner } = await setup();
    const uploaded = await uploadWorkbook(asOwner, [
      ['Task', 'Notes', 'Deadline'],
      ['First', 'hello', '2026-09-01'],
      ['Second', '', ''],
      ['', '', ''],
      ['Bad date', '', 'not-a-date'],
    ]);
    expect(uploaded.status).toBe(201);
    const id = uploaded.data!.id;

    // Confirming before a mapping exists is a conflict.
    const early = await asOwner.imports({ importId: id }).confirm.post();
    expect(early.status).toBe(409);

    const saved = await saveMapping(id, {
      title: 'Task',
      description: 'Notes',
      dueDate: 'Deadline',
    });
    // The all-blank row is dropped at parse time, so three rows remain: two
    // import cleanly, the one with an unreadable date is reported as skipped
    // with its sheet row number (blank lines included in the count).
    expect(saved.totalRows).toBe(3);

    const draft = await asOwner.imports({ importId: id }).get();
    expect(draft.data!.status).toBe('mapped');
    expect(draft.data!.mapping).toMatchObject({ title: 'Task' });

    const confirm = await asOwner.imports({ importId: id }).confirm.post();
    expect(confirm.status).toBe(200);
    expect(confirm.data!.imported).toHaveLength(2);
    expect(confirm.data!.imported[0]).toMatchObject({ key: 'MKT-1', title: 'First' });
    expect(confirm.data!.skipped).toEqual([
      { row: 5, reason: '"not-a-date" is not a readable date' },
    ]);

    const again = await asOwner.imports({ importId: id }).confirm.post();
    expect(again.status).toBe(409);

    const done = await asOwner.imports({ importId: id }).get();
    expect(done.data!.status).toBe('confirmed');

    const issues = await asOwner.projects({ projectKey: 'MKT' }).issues.get();
    const titles = issues.data!.map((i) => i.title).sort();
    expect(titles).toEqual(['First', 'Second']);
    const first = issues.data!.find((i) => i.title === 'First');
    // Treaty revives the iso() date into a Date on the client, though its type
    // still says string — hence the cast.
    expect(new Date(first!.dueDate as string).toISOString().slice(0, 10)).toBe('2026-09-01');
  });

  it('cancels a draft and refuses to confirm it afterwards', async () => {
    const { asOwner } = await setup();
    const uploaded = await uploadWorkbook(asOwner, [['Task'], ['Only']]);
    const id = uploaded.data!.id;
    const canceled = await asOwner.imports({ importId: id }).cancel.post();
    expect(canceled.status).toBe(204);
    const confirm = await asOwner.imports({ importId: id }).confirm.post();
    expect(confirm.status).toBe(409);
    const draft = await asOwner.imports({ importId: id }).get();
    expect(draft.data!.status).toBe('canceled');
  });

  it('hides drafts of other projects', async () => {
    const { asOwner } = await setup();
    await asOwner.projects.post({ key: 'OPS', name: 'Ops' });
    const uploaded = await uploadWorkbook(asOwner, [['Task']]);
    const id = uploaded.data!.id;
    const wrong = await authedApi((await signUpTestUser()).cookie)
      .imports({ importId: id })
      .get();
    expect(wrong.status).toBe(403);
  });
});
