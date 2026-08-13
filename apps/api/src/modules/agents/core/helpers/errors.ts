// Reduces an unknown thrown value to a human-readable message: the Error's message,
// the string itself, or the given fallback for anything else.
export function errorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return fallback;
}
