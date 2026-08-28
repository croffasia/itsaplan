import { describe, it, expect, beforeEach } from 'bun:test';
import ExcelJS from 'exceljs';
import { authedApi } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { getProjectByKey } from '#modules/projects/service';
import { createMappedImport } from '../../service';

// The import flow: the file is uploaded through the chat-attachments route, an
// agent turns it into a draft by saving a column mapping (the
// prepare_issue_import tool calls createMappedImport in process), and the confirm
// route creates the issues. Needs MinIO like the attachments suite.

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
  return client.projects({ projectKey: 'MKT' })['chat-attachments'].post({
    filename: name,
    contentBase64: bytes.toString('base64'),
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

async function mapImport(attachmentId: string, mapping: Record<string, string>) {
  const project = await getProjectByKey('MKT');
  if (!project) throw new Error('Test project was not created');
  return createMappedImport(project.id, attachmentId, mapping);
}

describe('imports', () => {
  beforeEach(async () => {
    await resetDb();
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
    const attachmentId = uploaded.data!.id;

    // Confirming an unknown draft is a plain 404.
    const missing = await asOwner.imports({ importId: crypto.randomUUID() }).confirm.post();
    expect(missing.status).toBe(404);

    const draft = await mapImport(attachmentId, {
      title: 'Task',
      description: 'Notes',
      dueDate: 'Deadline',
    });
    expect(draft.status).toBe('mapped');

    const read = await asOwner.imports({ importId: draft.id }).get();
    expect(read.data!.status).toBe('mapped');
    expect(read.data!.filename).toBe('tasks.xlsx');
    expect(read.data!.mapping).toMatchObject({ title: 'Task' });

    const confirm = await asOwner.imports({ importId: draft.id }).confirm.post();
    expect(confirm.status).toBe(200);
    expect(confirm.data!.imported).toHaveLength(2);
    expect(confirm.data!.imported[0]).toMatchObject({ key: 'MKT-1', title: 'First' });
    // The all-blank row is dropped at parse time, so three rows remain: two
    // import cleanly, the one with an unreadable date is reported as skipped
    // with its sheet row number (blank lines included in the count).
    expect(confirm.data!.skipped).toEqual([
      { row: 5, reason: '"not-a-date" is not a readable date' },
    ]);

    const again = await asOwner.imports({ importId: draft.id }).confirm.post();
    expect(again.status).toBe(409);

    const done = await asOwner.imports({ importId: draft.id }).get();
    expect(done.data!.status).toBe('confirmed');

    const issues = await asOwner.projects({ projectKey: 'MKT' }).issues.get();
    const titles = issues.data!.map((i) => i.title).sort();
    expect(titles).toEqual(['First', 'Second']);
    const first = issues.data!.find((i) => i.title === 'First');
    // Treaty revives the iso() date into a Date on the client, though its type
    // still says string — hence the cast.
    expect(new Date(first!.dueDate as string).toISOString().slice(0, 10)).toBe('2026-09-01');
  });

  it('marks a row whose title the project already has and skips it on confirm', async () => {
    const { asOwner } = await setup();
    const uploaded = await uploadWorkbook(asOwner, [['Task'], ['First'], ['Second'], [' first ']]);
    const first = await mapImport(uploaded.data!.id, { title: 'Task' });
    expect((await asOwner.imports({ importId: first.id }).confirm.post()).status).toBe(200);

    const second = await mapImport(
      (await uploadWorkbook(asOwner, [['Task'], ['First']])).data!.id,
      {
        title: 'Task',
      },
    );
    const read = await asOwner.imports({ importId: second.id }).get();
    expect(read.data!.preview!.rows).toEqual([
      { cells: ['First'], skip: 'An issue with this title exists' },
    ]);

    const confirm = await asOwner.imports({ importId: second.id }).confirm.post();
    expect(confirm.data!.imported).toEqual([]);
    expect(confirm.data!.skipped).toEqual([{ row: 2, reason: 'An issue with this title exists' }]);

    const issues = await asOwner.projects({ projectKey: 'MKT' }).issues.get();
    expect(issues.data!.map((i) => i.title).sort()).toEqual(['First', 'Second']);
  });

  it('refuses a mapping that names a column the file does not have', async () => {
    const { asOwner } = await setup();
    const uploaded = await uploadWorkbook(asOwner, [['Task'], ['Only']]);
    await expect(mapImport(uploaded.data!.id, { title: 'Nope' })).rejects.toThrow(
      'not in the file',
    );
  });

  it('refuses to map a file that does not parse into a table', async () => {
    const { asOwner } = await setup();
    const uploaded = await asOwner.projects({ projectKey: 'MKT' })['chat-attachments'].post({
      filename: 'server.log',
      contentBase64: Buffer.from('line one\nline two').toString('base64'),
      contentType: 'text/plain',
    });
    expect(uploaded.status).toBe(201);
    await expect(mapImport(uploaded.data!.id, { title: 'Task' })).rejects.toThrow('Unsupported');
  });

  it('refuses to map an attachment of another project', async () => {
    const { asOwner } = await setup();
    await asOwner.projects.post({ key: 'OPS', name: 'Ops' });
    const uploaded = await uploadWorkbook(asOwner, [['Task'], ['Only']]);
    const ops = await getProjectByKey('OPS');
    if (!ops) throw new Error('Test project was not created');
    await expect(createMappedImport(ops.id, uploaded.data!.id, { title: 'Task' })).rejects.toThrow(
      'Attachment not found',
    );
  });

  it('cancels a draft and refuses to confirm it afterwards', async () => {
    const { asOwner } = await setup();
    const uploaded = await uploadWorkbook(asOwner, [['Task'], ['Only']]);
    const draft = await mapImport(uploaded.data!.id, { title: 'Task' });
    const canceled = await asOwner.imports({ importId: draft.id }).cancel.post();
    expect(canceled.status).toBe(204);
    const confirm = await asOwner.imports({ importId: draft.id }).confirm.post();
    expect(confirm.status).toBe(409);
    const read = await asOwner.imports({ importId: draft.id }).get();
    expect(read.data!.status).toBe('canceled');
  });

  it('hides drafts of other projects', async () => {
    const { asOwner } = await setup();
    await asOwner.projects.post({ key: 'OPS', name: 'Ops' });
    const uploaded = await uploadWorkbook(asOwner, [['Task']]);
    const draft = await mapImport(uploaded.data!.id, { title: 'Task' });
    const wrong = await authedApi((await signUpTestUser()).cookie)
      .imports({ importId: draft.id })
      .get();
    expect(wrong.status).toBe(403);
  });
});
