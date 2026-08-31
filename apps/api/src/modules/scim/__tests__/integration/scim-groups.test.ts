import { describe, expect, it, beforeEach } from 'bun:test';
import { resetDb } from '#tests/helpers/db';
import { patchOps, scimUserBody, setupScim } from '../helpers';

const groupBody = (overrides: Record<string, unknown> = {}) => ({
  schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
  displayName: 'Engineering',
  ...overrides,
});

describe('SCIM groups', () => {
  beforeEach(resetDb);

  describe('POST /scim/v2/Groups', () => {
    it('provisions a group with its members', async () => {
      const { scim } = await setupScim();
      const ada = await scim.scim.v2.Users.post(scimUserBody());

      const res = await scim.scim.v2.Groups.post(
        groupBody({ externalId: 'idp-eng', members: [{ value: ada.data!.id }] }),
      );

      expect(res.status).toBe(201);
      expect(res.data).toMatchObject({
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
        displayName: 'Engineering',
        externalId: 'idp-eng',
        members: [{ value: ada.data!.id, display: 'Ada Lovelace' }],
        meta: { resourceType: 'Group' },
      });
    });

    it('refuses a name another group already has', async () => {
      const { scim } = await setupScim();
      await scim.scim.v2.Groups.post(groupBody());

      const res = await scim.scim.v2.Groups.post(groupBody());

      expect(res.status).toBe(409);
      expect(res.error!.value).toMatchObject({ scimType: 'uniqueness' });
    });

    it('refuses a member id that has no account', async () => {
      const { scim } = await setupScim();

      const res = await scim.scim.v2.Groups.post(groupBody({ members: [{ value: 'nobody' }] }));

      expect(res.status).toBe(400);
      expect(res.error!.value).toMatchObject({ scimType: 'invalidValue' });
      const groups = await scim.scim.v2.Groups.get({
        query: { filter: 'displayName eq "Engineering"' },
      });
      expect(groups.data).toMatchObject({ totalResults: 0 });
    });

    it('refuses a body with no displayName', async () => {
      const { scim } = await setupScim();

      const res = await scim.scim.v2.Groups.post({
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
      });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /scim/v2/Groups', () => {
    it('lists the groups and finds one by displayName', async () => {
      const { scim } = await setupScim();
      await scim.scim.v2.Groups.post(groupBody());
      await scim.scim.v2.Groups.post(groupBody({ displayName: 'Design' }));

      const all = await scim.scim.v2.Groups.get({ query: {} });
      expect(all.data).toMatchObject({ totalResults: 2 });

      const one = await scim.scim.v2.Groups.get({
        query: { filter: 'displayName eq "Design"' },
      });
      expect(one.data).toMatchObject({ totalResults: 1 });
      expect(one.data!.Resources[0]).toMatchObject({ displayName: 'Design' });
    });

    it('refuses a filter it does not implement', async () => {
      const { scim } = await setupScim();

      const res = await scim.scim.v2.Groups.get({ query: { filter: 'members eq "x"' } });

      expect(res.status).toBe(400);
      expect(res.error!.value).toMatchObject({ scimType: 'invalidFilter' });
    });
  });

  describe('GET /scim/v2/Groups/:id', () => {
    it('serves one group and 404s an unknown id', async () => {
      const { scim } = await setupScim();
      const created = await scim.scim.v2.Groups.post(groupBody());

      expect((await scim.scim.v2.Groups({ id: created.data!.id }).get()).status).toBe(200);
      expect(
        (await scim.scim.v2.Groups({ id: '00000000-0000-4000-8000-000000000000' }).get()).status,
      ).toBe(404);
    });
  });

  describe('PUT /scim/v2/Groups/:id', () => {
    it('replaces the name and the whole member list', async () => {
      const { scim } = await setupScim();
      const ada = await scim.scim.v2.Users.post(scimUserBody());
      const grace = await scim.scim.v2.Users.post(scimUserBody({ userName: 'grace@example.com' }));
      const created = await scim.scim.v2.Groups.post(
        groupBody({ members: [{ value: ada.data!.id }] }),
      );

      const res = await scim.scim.v2
        .Groups({ id: created.data!.id })
        .put(groupBody({ displayName: 'Platform', members: [{ value: grace.data!.id }] }));

      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ displayName: 'Platform' });
      expect(res.data!.members.map((m) => m.value)).toEqual([grace.data!.id]);
    });

    it('keeps the existing group when a replacement member is invalid', async () => {
      const { scim } = await setupScim();
      const created = await scim.scim.v2.Groups.post(groupBody());

      const res = await scim.scim.v2
        .Groups({ id: created.data!.id })
        .put(groupBody({ displayName: 'Platform', members: [{ value: 'nobody' }] }));

      expect(res.status).toBe(400);
      const group = await scim.scim.v2.Groups({ id: created.data!.id }).get();
      expect(group.data).toMatchObject({ displayName: 'Engineering', members: [] });
    });
  });

  describe('PATCH /scim/v2/Groups/:id', () => {
    it('adds and removes members', async () => {
      const { scim } = await setupScim();
      const ada = await scim.scim.v2.Users.post(scimUserBody());
      const grace = await scim.scim.v2.Users.post(scimUserBody({ userName: 'grace@example.com' }));
      const created = await scim.scim.v2.Groups.post(groupBody());

      const added = await scim.scim.v2.Groups({ id: created.data!.id }).patch(
        patchOps([
          { op: 'add', path: 'members', value: [{ value: ada.data!.id }] },
          { op: 'add', path: 'members', value: [{ value: grace.data!.id }] },
        ]),
      );
      expect(added.data!.members.map((m) => m.value).sort()).toEqual(
        [ada.data!.id, grace.data!.id].sort(),
      );

      const removed = await scim.scim.v2
        .Groups({ id: created.data!.id })
        .patch(patchOps([{ op: 'remove', path: 'members', value: [{ value: ada.data!.id }] }]));
      expect(removed.data!.members.map((m) => m.value)).toEqual([grace.data!.id]);
    });

    it('removes a member addressed by the RFC 7644 path filter, as Okta sends it', async () => {
      const { scim } = await setupScim();
      const ada = await scim.scim.v2.Users.post(scimUserBody());
      const grace = await scim.scim.v2.Users.post(scimUserBody({ userName: 'grace@example.com' }));
      const created = await scim.scim.v2.Groups.post(
        groupBody({ members: [{ value: ada.data!.id }, { value: grace.data!.id }] }),
      );

      const res = await scim.scim.v2
        .Groups({ id: created.data!.id })
        .patch(patchOps([{ op: 'remove', path: `members[value eq "${ada.data!.id}"]` }]));

      expect(res.data!.members.map((m) => m.value)).toEqual([grace.data!.id]);
    });

    it('renames the group', async () => {
      const { scim } = await setupScim();
      const created = await scim.scim.v2.Groups.post(groupBody());

      const res = await scim.scim.v2
        .Groups({ id: created.data!.id })
        .patch(patchOps([{ op: 'replace', path: 'displayName', value: 'Platform' }]));

      expect(res.data).toMatchObject({ displayName: 'Platform' });
    });

    it('refuses an attribute it cannot write', async () => {
      const { scim } = await setupScim();
      const created = await scim.scim.v2.Groups.post(groupBody());

      const res = await scim.scim.v2
        .Groups({ id: created.data!.id })
        .patch(patchOps([{ op: 'replace', path: 'description', value: 'nope' }]));

      expect(res.status).toBe(400);
      expect(res.error!.value).toMatchObject({ scimType: 'invalidPath' });
    });

    it('does not apply earlier member operations when a later operation is invalid', async () => {
      const { scim } = await setupScim();
      const ada = await scim.scim.v2.Users.post(scimUserBody());
      const created = await scim.scim.v2.Groups.post(groupBody());

      const res = await scim.scim.v2.Groups({ id: created.data!.id }).patch(
        patchOps([
          { op: 'add', path: 'members', value: [{ value: ada.data!.id }] },
          { op: 'replace', path: 'description', value: 'nope' },
        ]),
      );

      expect(res.status).toBe(400);
      const group = await scim.scim.v2.Groups({ id: created.data!.id }).get();
      expect(group.data!.members).toEqual([]);
    });
  });

  describe('DELETE /scim/v2/Groups/:id', () => {
    it('removes the group', async () => {
      const { scim } = await setupScim();
      const created = await scim.scim.v2.Groups.post(groupBody());

      expect((await scim.scim.v2.Groups({ id: created.data!.id }).delete()).status).toBe(204);
      expect((await scim.scim.v2.Groups({ id: created.data!.id }).get()).status).toBe(404);
    });

    it('404s an unknown id', async () => {
      const { scim } = await setupScim();

      expect(
        (await scim.scim.v2.Groups({ id: '00000000-0000-4000-8000-000000000000' }).delete()).status,
      ).toBe(404);
    });
  });
});
