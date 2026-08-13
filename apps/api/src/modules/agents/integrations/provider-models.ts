// Per-provider model lists, sourced from the models.dev registry (the same registry
// Mastra's model router resolves against). The registry is fetched once and cached in
// memory; the model select in the agent config UI reads it through listModelsForProvider.
// A model id the user types by hand is still accepted downstream, so a failed fetch only
// means the UI shows no suggestions, never a hard error.

const MODELS_DEV_URL = 'https://models.dev/api.json';
const TTL_MS = 24 * 60 * 60 * 1000;

export interface ProviderModel {
  id: string;
  name: string;
}

// Shape of the parts of the models.dev payload this module reads.
interface ModelsDevProvider {
  models?: Record<string, { name?: string; status?: string } | undefined>;
}

let cache: Map<string, ProviderModel[]> | null = null;
let cachedAt = 0;
let inflight: Promise<Map<string, ProviderModel[]>> | null = null;

async function fetchRegistry(): Promise<Map<string, ProviderModel[]>> {
  const res = await fetch(MODELS_DEV_URL);
  if (!res.ok) throw new Error(`models.dev responded ${res.status}`);
  const data = (await res.json()) as Record<string, ModelsDevProvider | undefined>;
  const byProvider = new Map<string, ProviderModel[]>();
  for (const [providerId, info] of Object.entries(data)) {
    if (!info || typeof info !== 'object' || !info.models) continue;
    const models = Object.entries(info.models)
      .filter(([, m]) => m?.status !== 'deprecated')
      .map(([id, m]) => ({ id, name: m?.name || id }))
      .sort((a, b) => a.id.localeCompare(b.id));
    if (models.length > 0) byProvider.set(providerId, models);
  }
  return byProvider;
}

// The registry, fresh within the TTL. Concurrent callers share one in-flight fetch. A
// fetch failure serves the stale cache when there is one, otherwise it rethrows.
async function getRegistry(): Promise<Map<string, ProviderModel[]>> {
  if (cache && Date.now() - cachedAt < TTL_MS) return cache;
  if (!inflight) {
    inflight = fetchRegistry()
      .then((registry) => {
        cache = registry;
        cachedAt = Date.now();
        return registry;
      })
      .catch((err) => {
        console.error('[integrations] failed to load models.dev registry:', err);
        if (cache) return cache;
        throw err;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

// Models known for a provider key, sorted by id. Empty when the provider is not in the
// registry or the registry could not be loaded.
export async function listModelsForProvider(provider: string): Promise<ProviderModel[]> {
  try {
    const registry = await getRegistry();
    return registry.get(provider) ?? [];
  } catch {
    return [];
  }
}
