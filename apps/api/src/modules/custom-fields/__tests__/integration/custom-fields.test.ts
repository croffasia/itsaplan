import { describe, it, expect, beforeEach } from 'bun:test';
import { authedApi, type Api } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

// Custom fields belong to a project. A field with issueTypeId null is
// project-wide; a field with issueTypeId set applies only to issues of that
// type. Routes live under /projects/:projectKey/custom-fields, so the permission
// guard runs on :projectKey and the service scopes every field to that project.
// Fields are read back through GET /projects/:projectKey/custom-fields, which
// takes an optional issueTypeId query to include that type's own fields.

async function setupProject() {
  const owner = await signUpTestUser();
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  return { asOwner };
}

// Treaty maps the hyphenated segment as a bracketed accessor.
function fields(client: Api, projectKey = 'MKT') {
  return client.projects({ projectKey })['custom-fields'];
}

// The project's custom fields, optionally scoped to an issue type.
async function listFields(client: Api, issueTypeId?: number, projectKey = 'MKT') {
  const res = await fields(client, projectKey).get(
    issueTypeId != null ? { query: { issueTypeId } } : {},
  );
  return res.data!;
}

function createType(client: Api, name: string, projectKey = 'MKT') {
  return client.projects({ projectKey })['issue-types'].post({ name });
}

// A project with an issue to hold field values, plus the ids needed to write them.
async function setupWithIssue() {
  const owner = await signUpTestUser();
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  const view = await asOwner.projects({ projectKey: 'MKT' }).get();
  const issue = (
    await asOwner.projects({ projectKey: 'MKT' }).issues.post({
      columnId: view.data!.columns[0].id,
      title: 'Task',
    })
  ).data!;
  return { asOwner, ownerUserId: owner.userId, issueId: issue.id };
}

// The entry an issue carries for a field. Every field of the issue's type is listed,
// so an unset one comes back with a null value rather than missing.
async function issueValue(client: Api, issueId: number, fieldId: number) {
  const res = await client.issues({ issueId }).get();
  return res.data!.fields.find((f) => f.fieldId === fieldId);
}

describe('custom-fields', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('create', () => {
    it('creates a project-wide field with defaults and lists it', async () => {
      const { asOwner } = await setupProject();

      const created = await fields(asOwner).post({ name: 'Severity', fieldType: 'text' });
      expect(created.status).toBe(201);
      expect(created.data).toMatchObject({
        name: 'Severity',
        fieldType: 'text',
        issueTypeId: null,
        showInBody: false,
        options: [],
      });
      expect(typeof created.data?.id).toBe('number');

      const list = await listFields(asOwner);
      expect(list.map((f) => f.name)).toContain('Severity');
    });

    it('stores showInBody when provided', async () => {
      const { asOwner } = await setupProject();
      const created = await fields(asOwner).post({
        name: 'Owner',
        fieldType: 'text',
        showInBody: true,
      });
      expect(created.data).toMatchObject({ showInBody: true });
    });

    it('creates a select field with ordered options', async () => {
      const { asOwner } = await setupProject();
      const created = await fields(asOwner).post({
        name: 'Priority',
        fieldType: 'select',
        options: ['Low', 'Medium', 'High'],
      });
      expect(created.status).toBe(201);
      expect(created.data?.options.map((o) => o.value)).toEqual(['Low', 'Medium', 'High']);
      expect(created.data?.options.map((o) => o.position)).toEqual([0, 1, 2]);
    });

    it('assigns increasing positions within the same scope', async () => {
      const { asOwner } = await setupProject();
      const first = (await fields(asOwner).post({ name: 'A', fieldType: 'text' })).data!;
      const second = (await fields(asOwner).post({ name: 'B', fieldType: 'text' })).data!;
      expect(second.position).toBeGreaterThan(first.position);
    });

    it('creates a type-scoped field targeting a type of this project', async () => {
      const { asOwner } = await setupProject();
      const type = (await createType(asOwner, 'Bug')).data!;

      const created = await fields(asOwner).post({
        name: 'Steps',
        fieldType: 'markdown',
        issueTypeId: type.id,
      });
      expect(created.status).toBe(201);
      expect(created.data).toMatchObject({ issueTypeId: type.id });
    });

    it('rejects a type-scoped field whose type belongs to another project', async () => {
      const { asOwner } = await setupProject();
      await asOwner.projects.post({ key: 'OPS', name: 'Operations' });
      const foreignType = (await createType(asOwner, 'Bug', 'OPS')).data!;

      const res = await fields(asOwner).post({
        name: 'Steps',
        fieldType: 'text',
        issueTypeId: foreignType.id,
      });
      expect(res.status).toBe(400);
    });

    it('rejects an issueTypeId that does not exist', async () => {
      const { asOwner } = await setupProject();
      const res = await fields(asOwner).post({
        name: 'Steps',
        fieldType: 'text',
        issueTypeId: 999999,
      });
      expect(res.status).toBe(400);
    });

    it('defaults a member field to the "all" scope', async () => {
      const { asOwner } = await setupProject();
      const created = await fields(asOwner).post({ name: 'Reviewer', fieldType: 'member' });
      expect(created.status).toBe(201);
      expect(created.data).toMatchObject({ fieldType: 'member', memberScope: 'all' });
    });

    it('stores the member scope it was created with', async () => {
      const { asOwner } = await setupProject();
      const created = await fields(asOwner).post({
        name: 'Runner',
        fieldType: 'member',
        memberScope: 'agents',
      });
      expect(created.data).toMatchObject({ memberScope: 'agents' });
    });

    it('leaves memberScope null on a field of another type', async () => {
      const { asOwner } = await setupProject();
      const created = await fields(asOwner).post({
        name: 'Severity',
        fieldType: 'text',
        memberScope: 'humans',
      });
      expect(created.data).toMatchObject({ fieldType: 'text', memberScope: null });
    });

    it('rejects a member scope outside the three it offers', async () => {
      const { asOwner } = await setupProject();
      const res = await fields(asOwner).post({
        name: 'Reviewer',
        fieldType: 'member',
        // @ts-expect-error the scope union rejects this at typecheck; the server rejects it too.
        memberScope: 'robots',
      });
      expect(res.status).toBe(400);
    });

    it('rejects an empty name', async () => {
      const { asOwner } = await setupProject();
      const res = await fields(asOwner).post({ name: '', fieldType: 'text' });
      expect(res.status).toBe(400);
    });

    it('creates the datetime field types', async () => {
      const { asOwner } = await setupProject();

      const moment = await fields(asOwner).post({ name: 'Kickoff', fieldType: 'datetime' });
      expect(moment.status).toBe(201);
      expect(moment.data).toMatchObject({ fieldType: 'datetime' });

      const slot = await fields(asOwner).post({ name: 'Slot', fieldType: 'datetime_range' });
      expect(slot.status).toBe(201);
      expect(slot.data).toMatchObject({ fieldType: 'datetime_range' });
    });

    it('rejects an unknown field type', async () => {
      const { asOwner } = await setupProject();
      const res = await fields(asOwner).post({
        name: 'Weird',
        fieldType: 'nonsense' as unknown as 'text',
      });
      expect(res.status).toBe(400);
    });

    it('rejects an empty option value', async () => {
      const { asOwner } = await setupProject();
      const res = await fields(asOwner).post({
        name: 'Priority',
        fieldType: 'select',
        options: [''],
      });
      expect(res.status).toBe(400);
    });
  });

  describe('list', () => {
    it('returns only project-wide fields without an issueTypeId', async () => {
      const { asOwner } = await setupProject();
      const type = (await createType(asOwner, 'Bug')).data!;
      await fields(asOwner).post({ name: 'Global', fieldType: 'text' });
      await fields(asOwner).post({ name: 'Scoped', fieldType: 'text', issueTypeId: type.id });

      const list = await listFields(asOwner);
      const names = list.map((f) => f.name);
      expect(names).toContain('Global');
      expect(names).not.toContain('Scoped');
    });

    it("includes a type's own fields when issueTypeId is passed", async () => {
      const { asOwner } = await setupProject();
      const bug = (await createType(asOwner, 'Bug')).data!;
      const story = (await createType(asOwner, 'Story')).data!;
      await fields(asOwner).post({ name: 'Global', fieldType: 'text' });
      await fields(asOwner).post({ name: 'BugField', fieldType: 'text', issueTypeId: bug.id });
      await fields(asOwner).post({ name: 'StoryField', fieldType: 'text', issueTypeId: story.id });

      const list = await listFields(asOwner, bug.id);
      const names = list.map((f) => f.name);
      expect(names).toContain('Global');
      expect(names).toContain('BugField');
      // Another type's field must not leak in.
      expect(names).not.toContain('StoryField');
    });

    it('returns fields ordered by position', async () => {
      const { asOwner } = await setupProject();
      await fields(asOwner).post({ name: 'First', fieldType: 'text' });
      await fields(asOwner).post({ name: 'Second', fieldType: 'text' });

      const list = await listFields(asOwner);
      const positions = list.map((f) => f.position);
      expect([...positions]).toEqual([...positions].sort((a, b) => a - b));
      expect(list.map((f) => f.name)).toEqual(['First', 'Second']);
    });

    it('returns 404 for an unknown project', async () => {
      const { asOwner } = await setupProject();
      const res = await fields(asOwner, 'NOPE').get({});
      expect(res.status).toBe(404);
    });
  });

  describe('update', () => {
    it('updates the name and showInBody', async () => {
      const { asOwner } = await setupProject();
      const field = (await fields(asOwner).post({ name: 'Severity', fieldType: 'text' })).data!;

      const patched = await fields(asOwner)({ fieldId: field.id }).patch({
        name: 'Level',
        showInBody: true,
      });
      expect(patched.status).toBe(200);
      expect(patched.data).toMatchObject({ name: 'Level', showInBody: true });

      const list = await listFields(asOwner);
      expect(list.find((f) => f.id === field.id)).toMatchObject({
        name: 'Level',
        showInBody: true,
      });
    });

    it('changes the type and clears the values issues held under the old one', async () => {
      const { asOwner, issueId } = await setupWithIssue();
      const field = (await fields(asOwner).post({ name: 'Severity', fieldType: 'text' })).data!;
      await asOwner.issues({ issueId }).fields({ fieldId: field.id }).put({ value: 'high' });

      const patched = await fields(asOwner)({ fieldId: field.id }).patch({ fieldType: 'number' });
      expect(patched.data).toMatchObject({ fieldType: 'number' });
      expect((await issueValue(asOwner, issueId, field.id))?.value).toBeNull();
    });

    it('drops the options when the type stops holding them', async () => {
      const { asOwner } = await setupWithIssue();
      const field = (
        await fields(asOwner).post({
          name: 'Priority',
          fieldType: 'select',
          options: ['Low', 'High'],
        })
      ).data!;

      const patched = await fields(asOwner)({ fieldId: field.id }).patch({ fieldType: 'text' });
      expect(patched.data).toMatchObject({ fieldType: 'text', options: [] });
    });

    it('renames an option in place and keeps the issues holding it', async () => {
      const { asOwner, issueId } = await setupWithIssue();
      const field = (
        await fields(asOwner).post({
          name: 'Priority',
          fieldType: 'select',
          options: ['Low', 'High'],
        })
      ).data!;
      const low = field.options[0];
      await asOwner
        .issues({ issueId })
        .fields({ fieldId: field.id })
        .put({ optionIds: [low.id] });

      const patched = await fields(asOwner)({ fieldId: field.id }).patch({
        options: [{ id: low.id, value: 'Lowest' }, { value: 'Urgent' }],
      });
      expect(patched.data!.options.map((o) => o.value)).toEqual(['Lowest', 'Urgent']);
      expect((await issueValue(asOwner, issueId, field.id))?.optionIds).toEqual([low.id]);
    });

    it('deletes an option left out of the list, and the selections of it', async () => {
      const { asOwner, issueId } = await setupWithIssue();
      const field = (
        await fields(asOwner).post({
          name: 'Priority',
          fieldType: 'select',
          options: ['Low', 'High'],
        })
      ).data!;
      const [low, high] = field.options;
      await asOwner
        .issues({ issueId })
        .fields({ fieldId: field.id })
        .put({ optionIds: [low.id] });

      const patched = await fields(asOwner)({ fieldId: field.id }).patch({
        options: [{ id: high.id, value: 'High' }],
      });
      expect(patched.data!.options.map((o) => o.value)).toEqual(['High']);
      expect((await issueValue(asOwner, issueId, field.id))?.optionIds ?? []).toEqual([]);
    });

    it('keeps the options when a select becomes a multi-select', async () => {
      const { asOwner } = await setupWithIssue();
      const field = (
        await fields(asOwner).post({
          name: 'Priority',
          fieldType: 'select',
          options: ['Low', 'High'],
        })
      ).data!;

      const patched = await fields(asOwner)({ fieldId: field.id }).patch({
        fieldType: 'multi_select',
        options: field.options.map((o) => ({ id: o.id, value: o.value })),
      });
      expect(patched.status).toBe(200);
      expect(patched.data).toMatchObject({ fieldType: 'multi_select' });
      expect(patched.data!.options.map((o) => o.id)).toEqual(field.options.map((o) => o.id));
    });

    it('rejects an option list with a repeated value', async () => {
      const { asOwner } = await setupWithIssue();
      const field = (
        await fields(asOwner).post({ name: 'Priority', fieldType: 'select', options: ['Low'] })
      ).data!;

      const res = await fields(asOwner)({ fieldId: field.id }).patch({
        options: [{ value: 'Same' }, { value: 'Same' }],
      });
      expect(res.status).toBe(400);
    });

    it('narrows a member scope and clears only the members it no longer allows', async () => {
      const { asOwner, ownerUserId, issueId } = await setupWithIssue();
      const agent = (
        await asOwner
          .projects({ projectKey: 'MKT' })
          ['ai-agents'].post({ name: 'Bot', username: 'bot', kind: 'external' })
      ).data!.agent;
      const forOwner = (
        await fields(asOwner).post({ name: 'Reviewer', fieldType: 'member', memberScope: 'all' })
      ).data!;
      const forAgent = (
        await fields(asOwner).post({ name: 'Runner', fieldType: 'member', memberScope: 'all' })
      ).data!;
      await asOwner
        .issues({ issueId })
        .fields({ fieldId: forOwner.id })
        .put({ value: ownerUserId });
      await asOwner
        .issues({ issueId })
        .fields({ fieldId: forAgent.id })
        .put({ value: agent.userId });

      await fields(asOwner)({ fieldId: forOwner.id }).patch({ memberScope: 'humans' });
      await fields(asOwner)({ fieldId: forAgent.id }).patch({ memberScope: 'humans' });

      expect((await issueValue(asOwner, issueId, forOwner.id))?.value).toBe(ownerUserId);
      expect((await issueValue(asOwner, issueId, forAgent.id))?.value).toBeNull();
    });

    it('returns 404 for a missing field', async () => {
      const { asOwner } = await setupProject();
      const res = await fields(asOwner)({ fieldId: 999999 }).patch({ name: 'Nope' });
      expect(res.status).toBe(404);
    });

    it('rejects an empty name', async () => {
      const { asOwner } = await setupProject();
      const field = (await fields(asOwner).post({ name: 'Severity', fieldType: 'text' })).data!;
      const res = await fields(asOwner)({ fieldId: field.id }).patch({ name: '' });
      expect(res.status).toBe(400);
    });

    it('rejects a non-numeric field id', async () => {
      const { asOwner } = await setupProject();
      const res = await fields(asOwner)({ fieldId: 'abc' as unknown as number }).patch({
        name: 'X',
      });
      expect(res.status).toBe(400);
    });
  });

  describe('delete', () => {
    it('deletes a field and drops it from the list', async () => {
      const { asOwner } = await setupProject();
      const field = (
        await fields(asOwner).post({
          name: 'Priority',
          fieldType: 'select',
          options: ['Low', 'High'],
        })
      ).data!;

      const del = await fields(asOwner)({ fieldId: field.id }).delete();
      expect(del.status).toBe(204);

      const list = await listFields(asOwner);
      expect(list.map((f) => f.id)).not.toContain(field.id);
    });

    it('returns 404 for a missing field', async () => {
      const { asOwner } = await setupProject();
      const res = await fields(asOwner)({ fieldId: 999999 }).delete();
      expect(res.status).toBe(404);
    });
  });

  // A field is addressed as /projects/:projectKey/custom-fields/:fieldId. The
  // permission guard runs on :projectKey, so the service scopes the field to that
  // project — a member of one project must not edit or delete another project's
  // field by passing its id.
  describe('cross-project isolation', () => {
    it('does not patch a field from another project', async () => {
      const { asOwner } = await setupProject();
      await asOwner.projects.post({ key: 'OPS', name: 'Operations' });
      const foreign = (await fields(asOwner, 'OPS').post({ name: 'Foreign', fieldType: 'text' }))
        .data!;

      const res = await fields(asOwner)({ fieldId: foreign.id }).patch({ name: 'Hijacked' });
      expect(res.status).toBe(404);

      const opsFields = await listFields(asOwner, undefined, 'OPS');
      expect(opsFields.find((f) => f.id === foreign.id)?.name).toBe('Foreign');
    });

    it('does not delete a field from another project', async () => {
      const { asOwner } = await setupProject();
      await asOwner.projects.post({ key: 'OPS', name: 'Operations' });
      const foreign = (await fields(asOwner, 'OPS').post({ name: 'Foreign', fieldType: 'text' }))
        .data!;

      const res = await fields(asOwner)({ fieldId: foreign.id }).delete();
      expect(res.status).toBe(404);

      const opsFields = await listFields(asOwner, undefined, 'OPS');
      expect(opsFields.map((f) => f.id)).toContain(foreign.id);
    });
  });

  describe('access', () => {
    it('returns 404 for an unknown project on create', async () => {
      const { asOwner } = await setupProject();
      const res = await fields(asOwner, 'NOPE').post({ name: 'X', fieldType: 'text' });
      expect(res.status).toBe(404);
    });

    it('denies a non-member on every custom-fields route', async () => {
      const { asOwner } = await setupProject();
      const field = (await fields(asOwner).post({ name: 'Severity', fieldType: 'text' })).data!;
      const outsider = authedApi((await signUpTestUser()).cookie);

      // Guard-thrown 403 is not in Treaty's inferred error-status union, so assert
      // the top-level HTTP status rather than error.status.
      expect((await fields(outsider).get({})).status).toBe(403);
      expect((await fields(outsider).post({ name: 'X', fieldType: 'text' })).status).toBe(403);
      expect((await fields(outsider)({ fieldId: field.id }).patch({ name: 'X' })).status).toBe(403);
      expect((await fields(outsider)({ fieldId: field.id }).delete()).status).toBe(403);
    });
  });
});
