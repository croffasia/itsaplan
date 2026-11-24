// The detector reads this much: a whole 10 MB file takes it over a second.
const SAMPLE_BYTES = 64 * 1024;

// Text from bytes that carry no declared encoding. Excel saves a CSV in the code
// page of the machine that wrote it, Windows-1251 on a Russian one. UTF-8 is
// checked exactly; any other encoding is guessed from the letters, so a file with
// only a few non-ASCII characters can still decode wrong.
export async function decodeText(bytes: Uint8Array): Promise<string> {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    const { detect } = await import('chardet');
    // ASCII reads the same in every candidate, so the sample starts past it.
    const start = bytes.findIndex((byte) => byte > 0x7f);
    const encoding = detect(bytes.subarray(start, start + SAMPLE_BYTES));
    try {
      return new TextDecoder(encoding ?? undefined).decode(bytes);
    } catch {
      // The detector names encodings a browser has no decoder for.
      return new TextDecoder().decode(bytes);
    }
  }
}
