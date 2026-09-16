import { beforeEach, describe, expect, it } from 'bun:test';
import { api } from '../helpers/app';
import { signUpTestUser } from '../helpers/auth';
import { resetDb } from '../helpers/db';

describe('auth config', () => {
  beforeEach(resetDb);

  it('reports whether any account exists', async () => {
    expect((await api['auth-config'].get()).data).toMatchObject({ hasUsers: false });

    await signUpTestUser();

    expect((await api['auth-config'].get()).data).toMatchObject({ hasUsers: true });
  });
});
