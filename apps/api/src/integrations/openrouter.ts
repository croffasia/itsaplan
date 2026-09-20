import { HttpError } from '../shared/lib';

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

// The timeout is a per-caller argument because image generation runs far longer
// than a chat completion.
export async function callOpenRouter(
  path: string,
  apiKey: string,
  body: unknown,
  timeoutMs: number,
): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(`${OPENROUTER_BASE}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    console.error('[planner] OpenRouter request failed:', err);
    throw new HttpError(502, 'Could not reach OpenRouter');
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new HttpError(
      502,
      `OpenRouter responded ${res.status}${detail ? `: ${detail.slice(0, 300)}` : ''}`,
    );
  }
  return res.json();
}

export async function chatCompletionText(
  apiKey: string,
  body: unknown,
  timeoutMs: number,
): Promise<string> {
  const payload = (await callOpenRouter('/chat/completions', apiKey, body, timeoutMs)) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = payload.choices?.[0]?.message?.content?.trim();
  if (!text) throw new HttpError(502, 'OpenRouter returned no text');
  return text;
}
