import { describe, it, expect } from 'bun:test';
import type { PinnedRequestInit } from '@repo/net';
import { HttpError } from '#shared/lib';
import { previewProcoreStates, procoreJobFields, testProcoreConnection } from '../../procore';
import { msprojectJobFields, parseMsProjectFile, uploadMsProjectFile } from '../../msproject';

interface SentRequest {
  url: string;
  init: PinnedRequestInit | undefined;
}

function answering(responses: Response[], sent: SentRequest[] = []) {
  const queue = [...responses];
  return async (url: string, init?: PinnedRequestInit) => {
    sent.push({ url, init });
    const next = queue.shift();
    if (!next) throw new Error(`unexpected request ${url}`);
    return next;
  };
}

const PROCORE = { clientId: 'cid', clientSecret: 'sec', companyId: '55' };
const token = () => Response.json({ access_token: 'tok', expires_in: 5400 });

async function httpError(promise: Promise<unknown>): Promise<HttpError> {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(HttpError);
  return error as HttpError;
}

describe('testProcoreConnection', () => {
  it('gets a token, then lists the company projects sorted by name', async () => {
    const sent: SentRequest[] = [];
    const result = await testProcoreConnection(
      PROCORE,
      answering(
        [
          token(),
          Response.json([
            { id: 2, name: 'Tower B' },
            { id: 1, name: 'Annex' },
          ]),
        ],
        sent,
      ),
    );
    expect(result.projects).toEqual([
      { id: '1', name: 'Annex' },
      { id: '2', name: 'Tower B' },
    ]);
    expect(sent[0]!.url).toBe('https://login.procore.com/oauth/token');
    expect(new URL(sent[1]!.url).searchParams.get('company_id')).toBe('55');
    expect(sent[1]!.init?.headers).toMatchObject({
      Authorization: 'Bearer tok',
      'Procore-Company-Id': '55',
    });
  });

  it('uses the sandbox hosts', async () => {
    const sent: SentRequest[] = [];
    await testProcoreConnection(
      { ...PROCORE, sandbox: true },
      answering([token(), Response.json([])], sent),
    );
    expect(sent[0]!.url).toBe('https://login-sandbox.procore.com/oauth/token');
    expect(new URL(sent[1]!.url).origin).toBe('https://sandbox.procore.com');
  });

  it('answers 400 for rejected credentials and an unreadable company, 502 for a rate limit', async () => {
    const bad = await httpError(
      testProcoreConnection(PROCORE, answering([new Response('', { status: 401 })])),
    );
    expect(bad.status).toBe(400);
    const forbidden = await httpError(
      testProcoreConnection(PROCORE, answering([token(), new Response('', { status: 403 })])),
    );
    expect(forbidden.status).toBe(400);
    const limited = await httpError(
      testProcoreConnection(PROCORE, answering([token(), new Response('', { status: 429 })])),
    );
    expect(limited.status).toBe(502);
  });

  it('rejects a blank client ID or a non-numeric company before any request', async () => {
    const never = answering([]);
    expect(
      (await httpError(testProcoreConnection({ ...PROCORE, clientId: ' ' }, never))).status,
    ).toBe(400);
    expect(
      (await httpError(testProcoreConnection({ ...PROCORE, companyId: 'a/b' }, never))).status,
    ).toBe(400);
  });
});

describe('previewProcoreStates', () => {
  it('checks the tool can be read and returns its states', async () => {
    const sent: SentRequest[] = [];
    const result = await previewProcoreStates(
      { ...PROCORE, procoreProjectId: '9', procoreTool: 'rfis' },
      answering([token(), Response.json([])], sent),
    );
    expect(result.states.map((s) => [s.id, s.category])).toEqual([
      ['draft', 'backlog'],
      ['open', 'started'],
      ['closed', 'completed'],
      ['void', 'canceled'],
    ]);
    expect(new URL(sent[1]!.url).pathname).toBe('/rest/v1.0/projects/9/rfis');
  });

  it('rejects an unknown tool and a non-numeric project', async () => {
    const never = answering([]);
    const tool = await httpError(
      previewProcoreStates({ ...PROCORE, procoreProjectId: '9', procoreTool: 'x' }, never),
    );
    expect(tool.status).toBe(400);
    const project = await httpError(
      previewProcoreStates({ ...PROCORE, procoreProjectId: 'z', procoreTool: 'rfis' }, never),
    );
    expect(project.status).toBe(400);
  });
});

describe('procoreJobFields', () => {
  it('trims and stores the account and the project/tool', () => {
    expect(
      procoreJobFields({
        source: 'procore',
        ...PROCORE,
        clientId: ' cid ',
        procoreProjectId: ' 9 ',
        procoreTool: 'punch_items',
      }),
    ).toEqual({
      source: 'procore',
      credential: { clientId: 'cid', clientSecret: 'sec', companyId: '55', sandbox: false },
      config: { procoreProjectId: '9', procoreTool: 'punch_items' },
    });
  });
});

const NS = 'http://schemas.microsoft.com/project';
const plan = (tasks: string, ns = NS) =>
  `<?xml version="1.0"?><Project xmlns="${ns}"><Tasks>${tasks}</Tasks></Project>`;

describe('parseMsProjectFile', () => {
  it('counts named tasks other than the project summary', () => {
    const xml = plan(
      '<Task><UID>0</UID><Name>Plan</Name></Task><Task><UID>1</UID><Name>A</Name></Task><Task><UID>2</UID><Name></Name></Task><Task><UID>3</UID><Name>B</Name></Task>',
    );
    expect(parseMsProjectFile(xml)).toEqual({ taskCount: 2 });
  });

  it('refuses a DOCTYPE, other XML, another namespace and broken XML', () => {
    expect(() => parseMsProjectFile('<!DOCTYPE p [<!ENTITY x "y">]>' + plan(''))).toThrow(
      HttpError,
    );
    expect(() => parseMsProjectFile('<Other/>')).toThrow('MSPDI');
    expect(() => parseMsProjectFile(plan('', 'http://example.com'))).toThrow('MSPDI');
    expect(() => parseMsProjectFile('not xml')).toThrow(HttpError);
  });
});

describe('uploadMsProjectFile', () => {
  it('rejects .mpp with the save-as-XML hint, and other extensions', async () => {
    const mpp = await httpError(uploadMsProjectFile(1, new File(['x'], 'Plan.MPP')));
    expect(mpp.status).toBe(400);
    expect(mpp.message).toContain('Save the plan as XML');
    expect((await httpError(uploadMsProjectFile(1, new File(['x'], 'plan.txt')))).status).toBe(400);
  });

  it('rejects a plan with no tasks before storing it', async () => {
    const empty = await httpError(uploadMsProjectFile(1, new File([plan('')], 'plan.xml')));
    expect(empty.status).toBe(400);
  });
});

describe('msprojectJobFields', () => {
  const input = (key: string) => ({
    source: 'msproject' as const,
    msprojectFileKey: key,
    msprojectName: ' plan.xml ',
  });

  it('accepts a key under the project prefix', () => {
    expect(msprojectJobFields(4, input('import-sources/4/abc.xml'))).toEqual({
      source: 'msproject',
      credential: {},
      config: { msprojectFileKey: 'import-sources/4/abc.xml', msprojectName: 'plan.xml' },
    });
  });

  it('rejects keys of another project or outside the prefix', () => {
    for (const key of [
      'import-sources/5/abc.xml',
      'other/4/abc.xml',
      'import-sources/4/../x.xml',
    ]) {
      expect(() => msprojectJobFields(4, input(key))).toThrow(HttpError);
    }
  });
});
