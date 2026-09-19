// The OpenRouter model catalogue, split into the models that return an image and
// the ones a caption can be written with. The listing is public, so it is fetched
// without a credential and cached in memory; a failed fetch only means the template
// form shows no suggestions, and a model id typed by hand is still accepted.

const MODELS_URL = 'https://openrouter.ai/api/v1/models';
const TTL_MS = 24 * 60 * 60 * 1000;

export interface StudioModel {
  id: string;
  name: string;
}

export interface StudioModels {
  image: StudioModel[];
  text: StudioModel[];
}

interface OpenRouterModel {
  id?: string;
  name?: string;
  architecture?: { output_modalities?: string[] };
}

let cache: StudioModels | null = null;
let cachedAt = 0;
let inflight: Promise<StudioModels> | null = null;

async function fetchModels(): Promise<StudioModels> {
  const res = await fetch(MODELS_URL, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`OpenRouter models responded ${res.status}`);
  const payload = (await res.json()) as { data?: OpenRouterModel[] };

  const image: StudioModel[] = [];
  const text: StudioModel[] = [];
  for (const model of payload.data ?? []) {
    if (!model.id) continue;
    const entry = { id: model.id, name: model.name || model.id };
    const outputs = model.architecture?.output_modalities ?? [];
    if (outputs.includes('image')) image.push(entry);
    if (outputs.includes('text')) text.push(entry);
  }
  const byId = (a: StudioModel, b: StudioModel) => a.id.localeCompare(b.id);
  return { image: image.sort(byId), text: text.sort(byId) };
}

export async function listOpenRouterModels(): Promise<StudioModels> {
  if (cache && Date.now() - cachedAt < TTL_MS) return cache;
  if (!inflight) {
    inflight = fetchModels()
      .then((models) => {
        cache = models;
        cachedAt = Date.now();
        return models;
      })
      .catch((err) => {
        console.error('[planner] could not load the OpenRouter model list:', err);
        return cache ?? { image: [], text: [] };
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}
