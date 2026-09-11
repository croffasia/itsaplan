import { describe, expect, it } from 'bun:test';
import { Elysia, t } from 'elysia';
import { AjvJsonSchemaValidator } from '@modelcontextprotocol/sdk/validation/ajv';
import type { JsonSchemaType } from '@modelcontextprotocol/sdk/validation/types.js';
import { dispatchTool } from '../../dispatch';
import { mcpTool, routeTools } from '../../generate';
import { outputSchema, structuredResult, toolError } from '../../result';

const validator = new AjvJsonSchemaValidator();

function validate(schema: ReturnType<typeof outputSchema>, value: unknown) {
  return validator.getValidator(schema as JsonSchemaType)(value).valid;
}

describe('structured MCP results', () => {
  it('keeps JSON objects, arrays, and primitives inside the data field', async () => {
    for (const data of [{ id: 1 }, [{ id: 1 }], 42, false, null, 'text']) {
      const response = Response.json(data);
      expect(structuredResult(response, await response.text(), 'GET')).toEqual({
        ok: true,
        status: 200,
        data,
      });
    }
  });

  it('uses null for an empty response and retains non-JSON text', () => {
    expect(structuredResult(new Response(null, { status: 204 }), '', 'DELETE')).toEqual({
      ok: true,
      status: 204,
      data: null,
    });
    for (const text of ['42', 'false', 'null', '"quoted"', ' plain text ']) {
      expect(structuredResult(new Response(text), text, 'GET')).toMatchObject({ data: text });
    }
    expect(
      structuredResult(new Response(''), '', 'GET', outputSchema({ 200: t.String() })),
    ).toMatchObject({ data: '' });
  });

  it('reads JSON media types and retains malformed JSON as text', () => {
    const response = new Response('', { headers: { 'content-type': 'application/problem+json' } });
    expect(structuredResult(response, '{"title":"Example"}', 'GET')).toMatchObject({
      data: { title: 'Example' },
    });
    expect(structuredResult(response, 'not JSON', 'GET')).toMatchObject({ data: 'not JSON' });
  });

  it('preserves domain errors and actionable validation details', async () => {
    const body = { error: 'Column is full', code: 'WIP_LIMIT', columnId: 3, limit: 2 };
    const response = Response.json(body, { status: 409 });
    const result = structuredResult(response, await response.text(), 'PATCH');
    expect(result).toEqual({
      ok: false,
      status: 409,
      error: {
        code: 'WIP_LIMIT',
        message: 'Column is full',
        retryable: false,
        retryAfterSeconds: null,
        details: body,
      },
    });
    expect(validate(outputSchema({ 200: t.Object({ id: t.Number() }) }), result)).toBe(true);
  });

  it('uses stable HTTP codes and safe messages for non-JSON failures', () => {
    const response = new Response('<html>Proxy failure</html>', { status: 502 });
    expect(structuredResult(response, '<html>Proxy failure</html>', 'GET')).toEqual({
      ok: false,
      status: 502,
      error: {
        code: 'HTTP_502',
        message: 'HTTP 502',
        retryable: true,
        retryAfterSeconds: null,
      },
    });
  });

  it('marks only transient failures of safe reads retryable', () => {
    for (const status of [400, 401, 403, 404, 409, 422, 408, 429, 500, 501, 502, 503, 504, 505]) {
      for (const method of ['GET', 'HEAD', 'OPTIONS', 'POST', 'PATCH', 'PUT', 'DELETE']) {
        const result = structuredResult(new Response(null, { status }), '', method);
        expect(result).toMatchObject({
          ok: false,
          status,
          error: {
            code: `HTTP_${status}`,
            retryable:
              ['GET', 'HEAD', 'OPTIONS'].includes(method) &&
              [408, 429, 500, 502, 503, 504].includes(status),
          },
        });
      }
    }
  });

  it('parses Retry-After without exposing other response headers', () => {
    const response = new Response(null, {
      status: 429,
      headers: {
        'retry-after': '120',
        'set-cookie': 'sensitive-cookie',
        'www-authenticate': 'sensitive-challenge',
        'x-private': 'sensitive-value',
      },
    });
    const result = structuredResult(response, '', 'POST');
    expect(result).toMatchObject({ error: { retryable: false, retryAfterSeconds: 120 } });
    expect(JSON.stringify(result)).not.toContain('sensitive');

    for (const header of ['-1', '1.5', 'Infinity', 'tomorrow', '99999999999999999999']) {
      response.headers.set('retry-after', header);
      expect(structuredResult(response, '', 'GET')).toMatchObject({
        error: { retryAfterSeconds: null },
      });
    }
    response.headers.set('retry-after', new Date(Date.now() + 60_000).toUTCString());
    const dated = structuredResult(response, '', 'GET');
    expect(dated.ok).toBe(false);
    if (!dated.ok) {
      expect(dated.error.retryAfterSeconds).toBeGreaterThanOrEqual(59);
      expect(dated.error.retryAfterSeconds).toBeLessThanOrEqual(60);
    }
    response.headers.set('retry-after', 'Thu, 01 Jan 1970 00:00:00 GMT');
    expect(structuredResult(response, '', 'GET')).toMatchObject({
      error: { retryAfterSeconds: 0 },
    });
  });
});

describe('MCP output schemas', () => {
  it('correlates each declared success status with its response schema and accepts errors', () => {
    const schema = outputSchema({
      200: t.Array(t.Object({ id: t.Number() })),
      201: t.Object({ id: t.Number() }),
      204: t.Void(),
      400: t.Object({ error: t.String() }),
    });
    expect(validate(schema, { ok: true, status: 200, data: [{ id: 1 }] })).toBe(true);
    expect(validate(schema, { ok: true, status: 201, data: { id: 1 } })).toBe(true);
    expect(validate(schema, { ok: true, status: 204, data: null })).toBe(true);
    expect(validate(schema, { ok: true, status: 200, data: { id: 1 } })).toBe(false);
    expect(validate(schema, { ok: true, status: 201, data: [{ id: 1 }] })).toBe(false);
    expect(validate(schema, { ok: true, status: 204, data: '' })).toBe(false);
    expect(validate(schema, { ok: true, status: 200, data: [{ id: 'wrong' }] })).toBe(false);
    expect(validate(schema, toolError(409, 'Conflict'))).toBe(true);
    expect(validate(schema, toolError(429, 'Slow down'))).toBe(true);
  });

  it('uses a consistent permissive envelope for undeclared or unresolved schemas', () => {
    for (const response of [undefined, 'NamedSchema', { 200: { $ref: '#/definitions/Thing' } }]) {
      const schema = outputSchema(response);
      for (const data of [null, 'text', 42, [], { nested: [1, 2] }]) {
        expect(validate(schema, { ok: true, status: 200, data })).toBe(true);
      }
      expect(validate(schema, { ok: true, status: 202, data: { accepted: true } })).toBe(true);
      expect(validate(schema, toolError(403, 'Forbidden'))).toBe(true);
    }
  });

  it('omits runtime-only schema types and references without breaking unions', () => {
    const schema = outputSchema({
      200: {
        oneOf: [{ $ref: '#/Unresolved' }, { type: 'Date' }],
        $id: 'runtime-schema',
      },
    });
    expect(JSON.stringify(schema)).not.toContain('$ref');
    expect(JSON.stringify(schema)).not.toContain('$id');
    expect(validate(schema, { ok: true, status: 200, data: '2026-09-09' })).toBe(true);
  });

  it('keeps literal strings and numeric primitives consistent with real Elysia responses', async () => {
    const app = new Elysia()
      .get('/string', () => '42', { response: t.String(), detail: mcpTool('string') })
      .get('/number', () => 42, { response: t.Number(), detail: mcpTool('number') })
      .get('/boolean', () => false, { response: t.Boolean(), detail: mcpTool('boolean') })
      .get('/union', () => 'false', {
        response: t.Union([t.String(), t.Boolean()]),
        detail: mcpTool('union'),
      });
    const expected: Record<string, unknown> = {
      string: '42',
      number: 42,
      boolean: false,
      union: 'false',
    };
    for (const tool of routeTools(app)) {
      const result = await dispatchTool(
        app,
        tool,
        {},
        { kind: 'api-key', apiKey: 'unused' },
        { viaMcpEndpoint: true },
      );
      expect(result.text).toBe(String(expected[tool.name]));
      expect(result.isError).toBe(false);
      expect(result.structuredContent).toEqual({
        ok: true,
        status: 200,
        data: expected[tool.name],
      });
      expect(validate(tool.outputSchema, result.structuredContent)).toBe(true);
    }
  });
});
