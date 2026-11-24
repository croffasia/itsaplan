import { afterAll, afterEach, describe, expect, it, spyOn } from 'bun:test';
import { getTool } from '../../../registry';
import { kieFindModels } from '../find-models';
import { kieModelDocs } from '../model-docs';
import { kieCreateTask } from '../create-task';
import { kieGetTask } from '../get-task';
import { kieCredits } from '../credits';
import { verifyKie } from '../verify';

const fetchSpy = spyOn(globalThis, 'fetch');
const credential = { apiKey: 'kie-key' };

function respond(...bodies: (unknown | Response)[]) {
  for (const body of bodies) {
    fetchSpy.mockResolvedValueOnce(body instanceof Response ? body : Response.json(body));
  }
}

function call(n: number) {
  const [url, init] = fetchSpy.mock.calls[n]!;
  return {
    url: String(url),
    init: (init ?? {}) as RequestInit & { headers: Record<string, string> },
  };
}

const INDEX = [
  '- Image    Models > Google [Google - Nano Banana Edit](https://docs.kie.ai/market/google/nano-banana-edit.md): Image editing using Nano Banana',
  '- Image    Models > Google [Google - Nano Banana Callbacks](https://docs.kie.ai/market/google/nano-banana-callbacks.md): ',
  '- Video Models > Veo3.1 API [Generate Veo3.1 Video](https://docs.kie.ai/veo3-api/generate-veo-3-video.md): :::warning',
  '- Video Models > Veo3.1 API [生成veo3.1视频](https://docs.kie.ai/cn/veo3-api/generate-veo-3-video.md): :::warning',
  '- Chat  Models > Claude [Claude Opus](https://docs.kie.ai/market/claude/claude-opus-5.md): Chat',
].join('\n');

describe('kie', () => {
  afterEach(() => fetchSpy.mockReset());
  afterAll(() => fetchSpy.mockRestore());

  it('is registered with the partner link on the site and the key help', () => {
    const found = getTool('kie_create_task');
    expect(found?.integration.key).toBe('kie');
    expect(found?.integration.website).toBe('https://kie.ai?ref=0b6eb19939298accdf58e18b1a92a26e');
    expect(found?.integration.credentialSchema[0]?.help).toContain(
      '(https://kie.ai?ref=0b6eb19939298accdf58e18b1a92a26e)',
    );
  });

  it('lists the generation models of the docs index without callbacks or translations', async () => {
    respond(new Response(INDEX));
    expect(await kieFindModels.execute({}, {})).toEqual({
      models: [
        {
          type: 'image',
          family: 'Google',
          title: 'Google - Nano Banana Edit',
          page: 'market/google/nano-banana-edit',
          description: 'Image editing using Nano Banana',
        },
        {
          type: 'video',
          family: 'Veo3.1 API',
          title: 'Generate Veo3.1 Video',
          page: 'veo3-api/generate-veo-3-video',
          description: '',
        },
      ],
    });
    expect(call(0).url).toBe('https://docs.kie.ai/llms.txt');

    respond(new Response(INDEX));
    const filtered = (await kieFindModels.execute({}, { query: 'Banana EDIT', type: 'image' })) as {
      models: { page: string }[];
    };
    expect(filtered.models.map((m) => m.page)).toEqual(['market/google/nano-banana-edit']);
  });

  it('returns the request part of a model page and refuses other pages', async () => {
    const page = [
      '# Google - Nano Banana Edit',
      'paths:',
      '  /api/v1/jobs/createTask:',
      '    post:',
      '      summary: Google - Nano Banana Edit',
      '      x-apidog-folder: market',
      '',
      '      requestBody:',
      '                  default: google/nano-banana-edit',
      '      responses:',
      '        "200": shared boilerplate',
    ].join('\n');
    respond(new Response(page));
    expect(await kieModelDocs.execute({}, { page: 'market/google/nano-banana-edit' })).toEqual({
      page: 'market/google/nano-banana-edit',
      docs: [
        'summary: Google - Nano Banana Edit',
        '      requestBody:',
        '                  default: google/nano-banana-edit',
      ].join('\n'),
    });
    expect(call(0).url).toBe('https://docs.kie.ai/market/google/nano-banana-edit.md');

    respond(new Response('# Get Remaining Credits\n  /api/v1/chat/credit:'));
    await expect(
      kieModelDocs.execute({}, { page: 'common-api/get-account-credits' }),
    ).rejects.toThrow('does not describe a createTask model');
    expect(kieModelDocs.inputSchema.safeParse({ page: '../secrets' }).success).toBe(false);
  });

  it('creates a task and returns the parsed result once it succeeds', async () => {
    respond(
      { code: 200, msg: 'success', data: { taskId: 'task_1' } },
      {
        code: 200,
        msg: 'success',
        data: {
          taskId: 'task_1',
          state: 'success',
          resultJson: '{"resultUrls":["https://tempfile.example/a.png"]}',
          creditsConsumed: 4,
        },
      },
    );
    const result = await kieCreateTask.execute(credential, {
      model: 'google/nano-banana-edit',
      input: { prompt: 'a cat', image_urls: ['https://example.com/cat.png'] },
      waitSeconds: 60,
    });

    const created = call(0);
    expect(created.url).toBe('https://api.kie.ai/api/v1/jobs/createTask');
    expect(created.init.method).toBe('POST');
    expect(created.init.headers).toMatchObject({ Authorization: 'Bearer kie-key' });
    expect(JSON.parse(String(created.init.body))).toEqual({
      model: 'google/nano-banana-edit',
      input: { prompt: 'a cat', image_urls: ['https://example.com/cat.png'] },
    });
    expect(call(1).url).toBe('https://api.kie.ai/api/v1/jobs/recordInfo?taskId=task_1');
    expect(result).toEqual({
      taskId: 'task_1',
      state: 'success',
      result: { resultUrls: ['https://tempfile.example/a.png'] },
      creditsConsumed: 4,
    });
  });

  it('reports a failed task and a task that is still running', async () => {
    respond({ code: 200, data: { state: 'fail', failCode: '500', failMsg: 'Prompt was flagged' } });
    expect(await kieGetTask.execute(credential, { taskId: 'task_2', waitSeconds: 0 })).toEqual({
      taskId: 'task_2',
      state: 'fail',
      error: 'Prompt was flagged',
    });

    respond({ code: 200, data: { state: 'generating', progress: 40 } });
    expect(await kieGetTask.execute(credential, { taskId: 'task_3', waitSeconds: 0 })).toEqual({
      taskId: 'task_3',
      state: 'generating',
      progress: 40,
    });
  });

  it('keeps the taskId when the status of a created task cannot be read', async () => {
    respond(
      { code: 200, msg: 'success', data: { taskId: 'task_4' } },
      { code: 429, msg: 'Too many requests' },
    );
    expect(
      await kieCreateTask.execute(credential, { model: 'veo-3-1', input: { prompt: 'x' } }),
    ).toEqual({
      taskId: 'task_4',
      state: 'unknown',
      error: 'Kie task status failed (429): Too many requests',
    });
  });

  it('refuses a wait the agent run may not outlast', () => {
    expect(
      kieCreateTask.inputSchema.safeParse({ model: 'veo-3-1', input: {}, waitSeconds: 121 })
        .success,
    ).toBe(false);
  });

  it('throws the code and the message of a call Kie refused with HTTP 200', async () => {
    respond({ code: 402, msg: 'Credits insufficient', data: null });
    await expect(
      kieCreateTask.execute(credential, { model: 'veo-3-1', input: { prompt: 'x' } }),
    ).rejects.toThrow('Kie create task failed (402): Credits insufficient');
  });

  it('returns the credit balance', async () => {
    respond({ code: 200, msg: 'success', data: 100.5 });
    expect(await kieCredits.execute(credential, {})).toEqual({ credits: 100.5 });
    expect(call(0).url).toBe('https://api.kie.ai/api/v1/chat/credit');
    expect(call(0).init.method).toBe('GET');
  });

  it('checks a key by reading the credit balance', async () => {
    const signal = new AbortController().signal;
    respond({ code: 200, msg: 'success', data: 100.5 });
    expect(await verifyKie(credential, signal)).toBe('valid');
    expect(call(0).url).toBe('https://api.kie.ai/api/v1/chat/credit');

    respond({ code: 401, msg: 'Unauthorized' });
    expect(await verifyKie(credential, signal)).toBe('rejected');

    respond({ code: 429, msg: 'Too many requests' });
    expect(await verifyKie(credential, signal)).toBe('unavailable');

    respond(new Response('<html>Bad gateway</html>', { status: 502 }));
    expect(await verifyKie(credential, signal)).toBe('unavailable');
  });
});
