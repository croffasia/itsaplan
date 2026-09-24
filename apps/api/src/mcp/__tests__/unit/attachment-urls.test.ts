import { describe, expect, it } from 'bun:test';
import { Elysia, t } from 'elysia';
import { withPublicAttachmentUrls, withStoredAttachmentUrls } from '../../attachment-urls';
import { dispatchTool } from '../../dispatch';
import { mcpTool, routeTools } from '../../generate';

const API = (process.env.API_URL ?? '').replace(/\/+$/, '');
const ID = '0b5c3a52-3f6e-4a4b-9b7f-5d0e8c1a2f34';

describe('withPublicAttachmentUrls', () => {
  it('points the web and api paths of an issue or initiative attachment at the api', () => {
    const body = JSON.stringify({
      description: `![a](/media/attachments/${ID}/raw)\n<video src="/media/initiative-attachments/${ID}/raw"></video>`,
      url: `/attachments/${ID}/raw`,
    });
    expect(JSON.parse(withPublicAttachmentUrls(body))).toEqual({
      description: `![a](${API}/attachments/${ID}/raw)\n<video src="${API}/initiative-attachments/${ID}/raw"></video>`,
      url: `${API}/attachments/${ID}/raw`,
    });
  });

  it('reads a path at the start of a line inside a JSON string', () => {
    const body = JSON.stringify({ description: `see below\n/media/attachments/${ID}/raw` });
    expect(JSON.parse(withPublicAttachmentUrls(body)).description).toBe(
      `see below\n${API}/attachments/${ID}/raw`,
    );
  });

  it('keeps the query of a download link', () => {
    expect(withPublicAttachmentUrls(`(/attachments/${ID}/raw?download=1)`)).toBe(
      `(${API}/attachments/${ID}/raw?download=1)`,
    );
  });

  it('leaves absolute urls, document assets and chat files alone', () => {
    const text = [
      `(https://web.example/media/attachments/${ID}/raw)`,
      `(https://api.example/attachments/${ID}/raw)`,
      `(/protected-media/projects/MKT/documents/1/assets/${ID}/raw)`,
      `(/projects/MKT/documents/1/assets/${ID}/raw)`,
      `(/media/chat-attachments/${ID}/raw)`,
    ].join(' ');
    expect(withPublicAttachmentUrls(text)).toBe(text);
  });
});

describe('withStoredAttachmentUrls', () => {
  it('writes the web path back into text', () => {
    expect(
      withStoredAttachmentUrls({
        description: `![a](${API}/attachments/${ID}/raw)`,
        fields: [{ value: `[b](${API}/initiative-attachments/${ID}/raw)` }],
      }),
    ).toEqual({
      description: `![a](/media/attachments/${ID}/raw)`,
      fields: [{ value: `[b](/media/initiative-attachments/${ID}/raw)` }],
    });
  });

  it('keeps a value that is only a url, and non-string values', () => {
    const args = { url: `${API}/attachments/${ID}/raw`, issueId: 7, done: false, note: null };
    expect(withStoredAttachmentUrls(args)).toEqual(args);
  });
});

describe('dispatchTool', () => {
  it('stores the web path and answers with the api url', async () => {
    let received: unknown;
    const app = new Elysia().post(
      '/echo',
      ({ body }) => {
        received = body;
        return body;
      },
      {
        body: t.Object({ description: t.String() }),
        detail: { summary: 'Echo', ...mcpTool('echo') },
      },
    );
    const description = `![a](${API}/attachments/${ID}/raw)`;
    const result = await dispatchTool(
      app,
      routeTools(app)[0]!,
      { description },
      { kind: 'api-key', apiKey: 'unused' },
      { viaMcpEndpoint: true },
    );
    expect(received).toEqual({ description: `![a](/media/attachments/${ID}/raw)` });
    expect(JSON.parse(result.text)).toEqual({ description });
  });
});
