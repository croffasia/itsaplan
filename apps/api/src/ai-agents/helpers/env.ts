// Reads a positive integer from an environment variable, falling back to the default
// when unset, empty, or not a positive finite number.
export function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
