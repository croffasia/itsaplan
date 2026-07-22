// Reads a positive-integer env var, falling back to `fallback` when it is unset,
// empty, non-numeric, or not greater than zero.
export function intEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
