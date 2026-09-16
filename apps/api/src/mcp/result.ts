type JsonSchema = Record<string, unknown>;

export type StructuredResult =
  | { ok: true; status: number; data: unknown }
  | {
      ok: false;
      status: number;
      error: {
        code: string;
        message: string;
        retryable: boolean;
        retryAfterSeconds: number | null;
        details?: unknown;
      };
    };

export interface McpOutputSchema {
  type: 'object';
  anyOf: JsonSchema[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function toolError(
  status: number,
  message: string,
): Extract<StructuredResult, { ok: false }> {
  return {
    ok: false,
    status,
    error: { code: `HTTP_${status}`, message, retryable: false, retryAfterSeconds: null },
  };
}

function retryAfterSeconds(value: string | null): number | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    const seconds = Number(trimmed);
    return Number.isSafeInteger(seconds) ? seconds : null;
  }
  if (!/^[A-Za-z]{3}, \d{2} [A-Za-z]{3} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(trimmed)) {
    return null;
  }
  const seconds = Math.max(0, Math.ceil((Date.parse(trimmed) - Date.now()) / 1000));
  return Number.isSafeInteger(seconds) ? seconds : null;
}

function allowsText(schema: unknown): boolean {
  if (!isRecord(schema)) return true;
  if ('const' in schema) return typeof schema.const === 'string';
  if (Array.isArray(schema.enum)) return schema.enum.some((value) => typeof value === 'string');
  if (schema.type) {
    return (
      schema.type === 'string' || (Array.isArray(schema.type) && schema.type.includes('string'))
    );
  }
  if (Array.isArray(schema.anyOf)) return schema.anyOf.some(allowsText);
  if (Array.isArray(schema.allOf)) return schema.allOf.every(allowsText);
  return true;
}

export function structuredResult(
  response: Response,
  text: string,
  method: string,
  schema?: McpOutputSchema,
): StructuredResult {
  const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  const isJson = contentType === 'application/json' || contentType?.endsWith('+json');
  const declared = schema?.anyOf.find((branch) => {
    const properties = branch.properties;
    return (
      isRecord(properties) &&
      isRecord(properties.status) &&
      properties.status.const === response.status
    );
  });
  const properties = declared?.properties;
  const keepsText = isRecord(properties) && allowsText(properties.data);
  let data: unknown = text;
  if (response.status === 204 || (text === '' && !keepsText)) data = null;
  else if (isJson || (declared && !keepsText)) {
    try {
      data = JSON.parse(text);
    } catch {
      // A non-JSON response retains its original text.
    }
  }
  if (response.status < 400) return { ok: true, status: response.status, data };

  const error = toolError(response.status, response.statusText || `HTTP ${response.status}`);
  if (isRecord(data)) {
    if (typeof data.error === 'string') error.error.message = data.error;
    else if (typeof data.message === 'string') error.error.message = data.message;
    if (typeof data.code === 'string' && data.code.length > 0) error.error.code = data.code;
    if (Object.keys(data).some((key) => !['error', 'message', 'code'].includes(key))) {
      error.error.details = data;
    } else if (data.error !== undefined && typeof data.error !== 'string') {
      error.error.details = data;
    }
  } else if (Array.isArray(data)) {
    error.error.details = data;
  }
  error.error.retryable =
    ['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase()) &&
    [408, 429, 500, 502, 503, 504].includes(response.status);
  error.error.retryAfterSeconds = retryAfterSeconds(response.headers.get('retry-after'));
  return error;
}

const errorSchema: JsonSchema = {
  type: 'object',
  properties: {
    ok: { const: false },
    status: { type: 'integer', minimum: 400, maximum: 599 },
    error: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        retryable: { type: 'boolean' },
        retryAfterSeconds: { type: ['integer', 'null'], minimum: 0 },
        details: {},
      },
      required: ['code', 'message', 'retryable', 'retryAfterSeconds'],
      additionalProperties: false,
    },
  },
  required: ['ok', 'status', 'error'],
  additionalProperties: false,
};

function successSchema(status: JsonSchema, data: JsonSchema): JsonSchema {
  return {
    type: 'object',
    properties: { ok: { const: true }, status, data },
    required: ['ok', 'status', 'data'],
    additionalProperties: false,
  };
}

// Only JSON Schema keywords are published; TypeBox runtime transforms and unresolved
// references cannot describe the serialized response safely.
function responseSchema(value: unknown): JsonSchema {
  if (!isRecord(value) || '$ref' in value) return {};
  if (value.type === 'void' || value.type === 'undefined') return { type: 'null' };
  const types = ['null', 'boolean', 'object', 'array', 'number', 'integer', 'string'];
  if (
    value.type !== undefined &&
    !(typeof value.type === 'string' && types.includes(value.type)) &&
    !(Array.isArray(value.type) && value.type.every((type) => types.includes(type)))
  ) {
    return {};
  }

  const schema: JsonSchema = {};
  for (const key of [
    'type',
    'title',
    'description',
    'const',
    'enum',
    'minimum',
    'maximum',
    'exclusiveMinimum',
    'exclusiveMaximum',
    'multipleOf',
    'minLength',
    'maxLength',
    'pattern',
    'minItems',
    'maxItems',
    'uniqueItems',
    'minProperties',
    'maxProperties',
    'required',
  ]) {
    if (value[key] !== undefined) schema[key] = value[key];
  }
  for (const key of ['properties', 'patternProperties']) {
    const fields = value[key];
    if (isRecord(fields)) {
      schema[key] = Object.fromEntries(
        Object.entries(fields).map(([name, field]) => [name, responseSchema(field)]),
      );
    }
  }
  for (const key of ['items', 'additionalProperties']) {
    const field = value[key];
    if (typeof field === 'boolean') schema[key] = field;
    else if (Array.isArray(field)) schema[key] = field.map(responseSchema);
    else if (field !== undefined) schema[key] = responseSchema(field);
  }
  for (const key of ['anyOf', 'oneOf', 'allOf']) {
    const branches = value[key];
    if (Array.isArray(branches)) {
      schema[key === 'oneOf' ? 'anyOf' : key] = branches.map(responseSchema);
    }
  }
  return schema;
}

export function outputSchema(response: unknown): McpOutputSchema {
  const success: [number, unknown][] = [];
  if (isRecord(response)) {
    const statuses = Object.keys(response).filter((key) => /^\d{3}$/.test(key));
    if (statuses.length === 0) success.push([200, response]);
    else {
      for (const status of statuses) {
        if (Number(status) >= 200 && Number(status) < 300) {
          success.push([Number(status), response[status]]);
        }
      }
    }
  }
  const declaredStatuses = success.map(([status]) => status);
  const fallbackStatus: JsonSchema = { type: 'integer', minimum: 200, maximum: 399 };
  if (declaredStatuses.length) fallbackStatus.not = { enum: declaredStatuses };
  return {
    type: 'object',
    anyOf: [
      ...success.map(([status, schema]) =>
        successSchema(
          { const: status },
          status === 204 ? { type: 'null' } : responseSchema(schema),
        ),
      ),
      successSchema(fallbackStatus, {}),
      errorSchema,
    ],
  };
}
