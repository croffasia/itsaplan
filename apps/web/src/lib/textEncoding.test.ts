import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { decodeText } from './textEncoding';

const CSV = 'Название;Количество;Комментарий\nМолоко;2;свежее\nХлеб;1;бородинский\n';

// Windows-1251 holds А–я in one run, 0xC0–0xFF.
const windows1251 = (text: string) =>
  Uint8Array.from(text, (char) => {
    const code = char.charCodeAt(0);
    return code < 0x80 ? code : code - 0x410 + 0xc0;
  });

const utf16le = (text: string) => {
  const bytes = new Uint8Array(2 + text.length * 2);
  bytes.set([0xff, 0xfe]);
  for (let i = 0; i < text.length; i++) {
    bytes[2 + i * 2] = text.charCodeAt(i) & 0xff;
    bytes[3 + i * 2] = text.charCodeAt(i) >> 8;
  }
  return bytes;
};

describe('decodeText', () => {
  it('reads UTF-8 as it is', async () => {
    assert.equal(await decodeText(new TextEncoder().encode(CSV)), CSV);
  });

  it('reads a CSV that Excel saved in Windows-1251', async () => {
    assert.equal(await decodeText(windows1251(CSV)), CSV);
  });

  it('reads the non-ASCII text that starts past the sample size', async () => {
    const text = 'id;name\n'.repeat(10_000) + CSV;
    assert.equal(await decodeText(windows1251(text)), text);
  });

  it('reads UTF-16 with a byte order mark', async () => {
    assert.equal(await decodeText(utf16le(CSV)), CSV);
  });
});
