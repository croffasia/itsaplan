import { callOpenRouter, chatCompletionText } from '../integrations/openrouter';
import { getCredentialSecret } from '../integrations/store';
import { HttpError } from '../shared/lib';
import type { StudioTemplateRow } from './store';

const REQUEST_TIMEOUT_MS = 120_000;

// The aspect ratios the layouts are drawn at, in the form OpenRouter's image API
// takes. Keep in sync with the canvas sizes the web renderer uses.
const ASPECT_RATIOS: Record<string, string> = {
  square: '1:1',
  portrait: '4:5',
  story: '9:16',
};

export interface GeneratedImage {
  bytes: Buffer;
  contentType: string;
}

export interface GeneratedCopy {
  lead: string;
  headline: string;
  subtext: string;
  caption: string;
  imagePrompt: string;
}

// The API key behind a template's credential. The credential must belong to the
// template's own project and be an OpenRouter one — the calls below speak only that
// API.
async function apiKeyFor(template: StudioTemplateRow): Promise<string> {
  if (template.credentialId == null) {
    throw new HttpError(400, 'This template has no OpenRouter credential set');
  }
  const secret = await getCredentialSecret(template.credentialId, template.projectId);
  if (!secret) throw new HttpError(400, "The template's credential no longer exists");
  if (secret.integrationKey !== 'openrouter') {
    throw new HttpError(400, 'Studio needs an OpenRouter credential');
  }
  const key = String(secret.config.apiKey ?? '');
  if (!key) throw new HttpError(400, "The template's credential has no API key");
  return key;
}

// The full image prompt: the template's style prompt first, so every post on one
// template asks for the same look, then what this post is about.
export function composeImagePrompt(template: StudioTemplateRow, prompt: string): string {
  return [template.stylePrompt.trim(), prompt.trim()].filter(Boolean).join('\n\n');
}

export async function generateImage(
  template: StudioTemplateRow,
  prompt: string,
): Promise<GeneratedImage> {
  const apiKey = await apiKeyFor(template);
  const payload = (await callOpenRouter(
    '/images',
    apiKey,
    {
      model: template.imageModel,
      prompt: composeImagePrompt(template, prompt),
      aspect_ratio: ASPECT_RATIOS[template.aspect] ?? '1:1',
      n: 1,
    },
    REQUEST_TIMEOUT_MS,
  )) as { data?: { b64_json?: string; media_type?: string }[] };

  const first = payload.data?.[0];
  if (!first?.b64_json) throw new HttpError(502, 'OpenRouter returned no image');
  return {
    bytes: Buffer.from(first.b64_json, 'base64'),
    contentType: first.media_type ?? 'image/png',
  };
}

const COPY_INSTRUCTIONS = [
  'You write social media posts. Answer with a JSON object and nothing else, with the keys:',
  '"lead" (max 40 characters, the quieter opening line set above the headline, often a',
  'short framing phrase such as "Your Rules. Your Money." — may be empty),',
  '"headline" (max 50 characters, the statement the post makes, set below the lead),',
  '"subtext" (max 120 characters, the supporting line),',
  '"caption" (max 400 characters, the text posted alongside the image),',
  '"imagePrompt" (a description of the photo to generate; describe only the subject and',
  'the scene, never text, logos or layout, because those are drawn by the template).',
  'Write short, plain, declarative sentences. No exclamation marks, no emoji, no hashtags.',
].join(' ');

export async function generateCopy(
  template: StudioTemplateRow,
  topic: string,
): Promise<GeneratedCopy> {
  if (!template.textModel) {
    throw new HttpError(400, 'This template has no text model set');
  }
  const apiKey = await apiKeyFor(template);
  const style = template.stylePrompt.trim();
  const content = await chatCompletionText(
    apiKey,
    {
      model: template.textModel,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: COPY_INSTRUCTIONS },
        {
          role: 'user',
          content: [style ? `Brand style: ${style}` : '', `Post topic: ${topic}`]
            .filter(Boolean)
            .join('\n'),
        },
      ],
    },
    REQUEST_TIMEOUT_MS,
  );

  let parsed: Partial<GeneratedCopy>;
  try {
    parsed = JSON.parse(content) as Partial<GeneratedCopy>;
  } catch {
    throw new HttpError(502, 'OpenRouter returned text that is not valid JSON');
  }
  return {
    lead: String(parsed.lead ?? ''),
    headline: String(parsed.headline ?? ''),
    subtext: String(parsed.subtext ?? ''),
    caption: String(parsed.caption ?? ''),
    imagePrompt: String(parsed.imagePrompt ?? ''),
  };
}
