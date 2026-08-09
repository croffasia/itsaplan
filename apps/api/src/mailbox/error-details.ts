const MAX_DEPTH = 4;
const MAX_KEYS = 40;
const MAX_ARRAY_ITEMS = 20;
const MAX_STRING_LENGTH = 8_000;
const SENSITIVE_KEY = /pass(word)?|secret|token|authorization|cookie|credential/i;
const AUTH_COMMAND_FIELD = /^(command|executedCommand|stderr|stdout|output)$/;
const ERROR_FIELDS = [
  'name',
  'message',
  'code',
  'errno',
  'syscall',
  'address',
  'port',
  'host',
  'hostname',
  'reason',
  'library',
  'function',
  'opensslErrorStack',
  'responseStatus',
  'responseText',
  'serverResponseCode',
  'authenticationFailed',
  'response',
  'command',
  'executedCommand',
  'stderr',
  'stdout',
  'output',
  'status',
  'signal',
  'cause',
] as const;

function redactAuthCommands(value: string): string {
  return value
    .replace(/(^|\n)([^\r\n]*?\s)?LOGIN\b[^\r\n]*/gi, '$1$2LOGIN [REDACTED]')
    .replace(/(^|\n)([^\r\n]*?\s)?AUTHENTICATE\b[^\r\n]*/gi, '$1$2AUTHENTICATE [REDACTED]')
    .replace(/(^|\n)([^\r\n]*?\s)?AUTH\b[^\r\n]*/gi, '$1$2AUTH [REDACTED]');
}

function redactString(value: string, secrets: string[], key?: string): string {
  let redacted = value;
  for (const secret of secrets) redacted = redacted.split(secret).join('[REDACTED]');
  if (key && AUTH_COMMAND_FIELD.test(key)) redacted = redactAuthCommands(redacted);
  return redacted.slice(0, MAX_STRING_LENGTH);
}

function readableBytes(value: ArrayBufferView): string {
  return new TextDecoder().decode(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
}

function sanitize(
  value: unknown,
  secrets: string[],
  seen: WeakSet<object>,
  depth: number,
  key?: string,
): unknown {
  if (key && SENSITIVE_KEY.test(key)) return '[REDACTED]';
  if (typeof value === 'string') return redactString(value, secrets, key);
  if (typeof value === 'number' || typeof value === 'boolean' || value == null) return value;
  if (typeof value === 'bigint') return value.toString();
  if (ArrayBuffer.isView(value)) return redactString(readableBytes(value), secrets, key);
  if (typeof value !== 'object') return String(value);
  if (depth >= MAX_DEPTH) return '[TRUNCATED]';
  if (seen.has(value)) return '[CIRCULAR]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_ITEMS).map((item) => sanitize(item, secrets, seen, depth + 1));
  }

  const source = value as Record<string, unknown>;
  const keys =
    value instanceof Error
      ? ERROR_FIELDS.filter((field) => source[field] !== undefined)
      : Object.keys(source).slice(0, MAX_KEYS);
  return Object.fromEntries(
    keys.map((field) => [field, sanitize(source[field], secrets, seen, depth + 1, field)]),
  );
}

function secretRepresentations(password: string, username: string): string[] {
  if (!password) return [];
  return [
    password,
    Buffer.from(password).toString('base64'),
    Buffer.from(`\0${username}\0${password}`).toString('base64'),
    Buffer.from(`${username}\0${username}\0${password}`).toString('base64'),
  ].filter((value, index, values) => value.length > 0 && values.indexOf(value) === index);
}

export function mailboxErrorDetails(
  error: unknown,
  password: string,
  username = '',
): Record<string, unknown> {
  const secrets = secretRepresentations(password, username);
  const sanitized = sanitize(error, secrets, new WeakSet(), 0);
  if (sanitized && typeof sanitized === 'object' && !Array.isArray(sanitized)) {
    return sanitized as Record<string, unknown>;
  }
  return { error: sanitized };
}
