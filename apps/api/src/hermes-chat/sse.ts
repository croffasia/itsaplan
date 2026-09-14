export interface HermesSseEvent {
  event: string;
  data: unknown;
}

export async function* readHermesSse(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<HermesSseEvent> {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += chunk.value.replace(/\r\n/g, '\n');
    let separator = buffer.indexOf('\n\n');
    while (separator !== -1) {
      const frame = buffer.slice(0, separator);
      buffer = buffer.slice(separator + 2);
      const lines = frame.split('\n');
      const event = lines
        .find((line) => line.startsWith('event:'))
        ?.slice(6)
        .trim();
      const dataText = lines
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n');
      if (event && dataText) {
        const data = JSON.parse(dataText) as unknown;
        yield { event, data };
      }
      separator = buffer.indexOf('\n\n');
    }
  }
}
