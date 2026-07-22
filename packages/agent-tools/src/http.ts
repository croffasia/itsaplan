// Reads a response as JSON, throwing a useful message when the call failed, so a
// tool surfaces the error to the model instead of a parse error.
export async function jsonOrThrow(res: Response, what: string): Promise<unknown> {
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${what} failed (${res.status})${body ? `: ${body.slice(0, 300)}` : ''}`);
  }
  return res.json();
}
