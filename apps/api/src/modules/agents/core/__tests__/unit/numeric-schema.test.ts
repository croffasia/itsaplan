import { describe, it, expect } from 'bun:test';
import { t } from 'elysia';
import { collapseNumericSchema } from '../../runtime/tools/numeric-schema';

// Runs on Elysia's own output, so an Elysia upgrade that changes the shape fails here
// instead of silently disabling the collapse.

describe('collapseNumericSchema', () => {
  it('collapses a plain Numeric field to just its number branch', () => {
    const schema = t.Object({ limit: t.Optional(t.Numeric({ description: 'Max results.' })) });
    expect(collapseNumericSchema(schema)).toEqual({
      type: 'object',
      properties: { limit: { description: 'Max results.', type: 'number' } },
    });
  });

  it('keeps real constraints and drops the string branch default of 0', () => {
    const schema = t.Object({
      count: t.Numeric({ minimum: 0, maximum: 200, description: 'Page size.' }),
    });
    expect(collapseNumericSchema(schema)).toEqual({
      type: 'object',
      required: ['count'],
      properties: {
        count: { minimum: 0, maximum: 200, description: 'Page size.', type: 'number' },
      },
    });
  });

  it('collapses an array of Integer (labelIds) at the items level', () => {
    const schema = t.Object({
      labelIds: t.Optional(t.Array(t.Integer(), { description: 'Label ids to attach.' })),
    });
    expect(collapseNumericSchema(schema)).toEqual({
      type: 'object',
      properties: {
        labelIds: {
          description: 'Label ids to attach.',
          type: 'array',
          items: { type: 'integer' },
        },
      },
    });
  });

  it('collapses the inner numeric anyOf but leaves the outer null union real', () => {
    // typeId/cycleId's shape: t.Nullable(t.Integer(...)) nests the numeric anyOf
    // inside a real union with {type: 'null'}. Only the inner one collapses.
    const schema = t.Object({
      typeId: t.Optional(t.Nullable(t.Integer({ description: 'Issue type id, or null.' }))),
    });
    expect(collapseNumericSchema(schema)).toEqual({
      type: 'object',
      properties: {
        typeId: {
          nullable: true,
          anyOf: [{ description: 'Issue type id, or null.', type: 'integer' }, { type: 'null' }],
        },
      },
    });
  });

  // The collapse rebuilds nodes as plain objects, dropping TypeBox's Symbol tag; compare via JSON,
  // which is all the model sees.
  function asJson(value: unknown): unknown {
    return JSON.parse(JSON.stringify(value));
  }

  it('leaves a real string-or-null union untouched', () => {
    const schema = t.Object({ note: t.Nullable(t.String({ description: 'A note.' })) });
    expect(collapseNumericSchema(schema)).toEqual(asJson(schema));
  });

  it('leaves a literal enum union untouched', () => {
    const schema = t.Object({
      state: t.Union([t.Literal('open'), t.Literal('all')]),
    });
    expect(collapseNumericSchema(schema)).toEqual(asJson(schema));
  });
});
