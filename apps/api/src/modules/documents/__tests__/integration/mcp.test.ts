import { beforeEach, describe, expect, it } from 'bun:test';
import { auth } from '@repo/auth';
import { dispatchTool } from '#mcp/dispatch';
import { routeTools } from '#mcp/generate';
import { app, authedApi } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

const contentJson = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Release checks', marks: [{ type: 'bold' }] }],
    },
  ],
};

async function setup() {
  const owner = await signUpTestUser();
  const api = authedApi(owner.cookie);
  expect((await api.projects.post({ key: 'MKT', name: 'Marketing' })).status).toBe(201);
  const apiKey = (await auth.api.createApiKey({ body: { userId: owner.userId, name: 'docs' } }))
    .key;
  return { api, apiKey };
}

async function call(apiKey: string, name: string, args: Record<string, unknown>) {
  const response = await app.handle(
    new Request('http://localhost/mcp', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name, arguments: args },
      }),
    }),
  );
  expect(response.status).toBe(200);
  const text = await response.text();
  const result = JSON.parse(text.slice(text.indexOf('data: ') + 6)).result;
  return {
    text: result.content[0].text as string,
    isError: result.isError === true,
    structuredContent: result.structuredContent,
  };
}

describe('document agent responses', () => {
  beforeEach(resetDb);

  it('defaults MCP and internal reads to Markdown while preserving the REST editor response', async () => {
    const { api, apiKey } = await setup();
    const document = (
      await api.projects({ projectKey: 'MKT' }).documents.post({
        title: 'Release guide',
        content: '**Release checks**',
        contentJson,
      })
    ).data!;
    const args = { projectKey: 'MKT', documentId: document.id };
    const compact = await call(apiKey, 'get_document', args);
    expect(compact.isError).toBe(false);
    expect(JSON.parse(compact.text)).toMatchObject({
      id: document.id,
      content: '**Release checks**',
      version: document.version,
    });
    expect(JSON.parse(compact.text)).not.toHaveProperty('contentJson');
    expect(compact.structuredContent).toMatchObject({
      ok: true,
      status: 200,
      data: JSON.parse(compact.text),
    });
    expect(compact.structuredContent.data).not.toHaveProperty('contentJson');

    const rich = await call(apiKey, 'get_document', { ...args, includeContentJson: true });
    expect(rich.isError).toBe(false);
    expect(JSON.parse(rich.text).contentJson).toEqual(contentJson);
    expect(rich.structuredContent.data.contentJson).toEqual(contentJson);
    expect(compact.text.length).toBeLessThan(rich.text.length);

    const tool = routeTools(app).find((tool) => tool.name === 'get_document')!;
    const internal = await dispatchTool(
      app,
      tool,
      args,
      { kind: 'api-key', apiKey },
      {
        viaMcpEndpoint: false,
      },
    );
    expect(internal.isError).toBe(false);
    expect(JSON.parse(internal.text)).not.toHaveProperty('contentJson');
    expect(internal.structuredContent).toMatchObject({
      ok: true,
      data: JSON.parse(internal.text),
    });
    expect(internal.structuredContent).not.toHaveProperty('data.contentJson');
    const internalRich = await dispatchTool(
      app,
      tool,
      { ...args, includeContentJson: true },
      { kind: 'api-key', apiKey },
      { viaMcpEndpoint: false },
    );
    expect(internalRich.isError).toBe(false);
    expect(JSON.parse(internalRich.text).contentJson).toEqual(contentJson);

    const rest = await api
      .projects({ projectKey: 'MKT' })
      .documents({ documentId: document.id })
      .get();
    expect(rest.data?.contentJson).toEqual(contentJson);
    expect(rest.data?.content).toBe('**Release checks**');
  });

  it('keeps Markdown writes and historical editor content consistent', async () => {
    const { api, apiKey } = await setup();
    const created = await call(apiKey, 'create_document', {
      projectKey: 'MKT',
      title: 'Release guide',
      content: '**Release checks**',
      contentJson,
    });
    expect(created.isError).toBe(false);
    const document = JSON.parse(created.text);
    expect(document).not.toHaveProperty('contentJson');
    const args = { projectKey: 'MKT', documentId: document.id };
    const restDocument = api.projects({ projectKey: 'MKT' }).documents({ documentId: document.id });
    expect((await restDocument.get()).data?.contentJson).toEqual(contentJson);

    const updated = await call(apiKey, 'update_document', {
      ...args,
      version: document.version,
      content: '# Updated release checks',
    });
    expect(updated.isError).toBe(false);
    expect(JSON.parse(updated.text)).not.toHaveProperty('contentJson');
    expect((await restDocument.get()).data).toMatchObject({
      content: '# Updated release checks',
      contentJson: null,
    });

    const revisions = (await restDocument.revisions.get()).data!;
    const revision = revisions.find((revision) => revision.version === document.version)!;
    const revisionArgs = { ...args, revisionId: revision.id };
    const historical = await call(apiKey, 'get_document_revision', revisionArgs);
    expect(historical.isError).toBe(false);
    expect(JSON.parse(historical.text)).not.toHaveProperty('contentJson');
    const historicalRich = await call(apiKey, 'get_document_revision', {
      ...revisionArgs,
      includeContentJson: true,
    });
    expect(JSON.parse(historicalRich.text).contentJson).toEqual(contentJson);

    const restored = await call(apiKey, 'restore_document_revision', {
      ...revisionArgs,
      version: JSON.parse(updated.text).version,
    });
    expect(restored.isError).toBe(false);
    expect(JSON.parse(restored.text)).not.toHaveProperty('contentJson');
    expect((await restDocument.get()).data).toMatchObject({
      content: '**Release checks**',
      contentJson,
    });
  });

  it('rejects an invalid editor output flag before creating a document', async () => {
    const { api, apiKey } = await setup();
    const result = await call(apiKey, 'create_document', {
      projectKey: 'MKT',
      title: 'Invalid output option',
      includeContentJson: 'true',
    });
    expect(result.isError).toBe(true);
    expect(result.text).toContain('includeContentJson');
    expect((await api.projects({ projectKey: 'MKT' }).documents.get({ query: {} })).data).toEqual(
      [],
    );
  });
});
