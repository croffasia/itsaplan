import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

export const getEnv = (text: string, key: string): string => {
  const match = text.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match ? match[1].replace(/\s+#.*$/, '').trim() : '';
};

export const setEnv = (text: string, key: string, value: string): string => {
  const line = new RegExp(`^${key}=.*$`, 'm');
  // The replacement is a function so $& and $1 in a generated secret stay literal.
  return line.test(text)
    ? text.replace(line, () => `${key}=${value}`)
    : `${text.replace(/\n*$/, '')}\n${key}=${value}\n`;
};

/** One .env file, written back on save(). Reads its .example when the file is missing, or
 *  when `fresh` asks for a file built from scratch rather than from what is already there. */
export class EnvFile {
  private text: string;

  constructor(
    private readonly path: string,
    fresh = false,
  ) {
    this.text = readFileSync(fresh || !existsSync(path) ? `${path}.example` : path, 'utf8');
  }

  get(key: string) {
    return getEnv(this.text, key);
  }

  set(key: string, value: string) {
    this.text = setEnv(this.text, key, value);
  }

  /** True while the key still holds an example value rather than one somebody chose. */
  isPlaceholder(key: string) {
    const current = this.get(key);
    return current === '' || current.startsWith('change-me');
  }

  /** Replaces a secret that still holds an example value; a real one is kept. */
  generate(key: string) {
    if (this.isPlaceholder(key)) this.set(key, randomBytes(32).toString('base64'));
  }

  save() {
    writeFileSync(this.path, this.text);
  }

  toString() {
    return this.text;
  }
}
