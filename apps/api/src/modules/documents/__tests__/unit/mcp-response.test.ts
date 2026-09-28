import { describe, expect, it } from 'bun:test';
import {
  documentInputSchema,
  documentOutputSchema,
  documentResponse,
  isDocumentResponseTool,
} from '#mcp/document-response';
import type { McpRouteTool } from '#mcp/generate';
import { outputSchema } from '#mcp/result';
import { DocumentResponse } from '../../model';

const document = {
  id: 7,
  title: 'Release guide',
  content: '# Release\n\nRun the checks.',
  contentJson: {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Release' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Run the checks.' }] },
    ],
  },
  version: 3,
};

describe('agent document responses', () => {
  it.each([
    'get_document',
    'get_document_revision',
    'create_document',
    'update_document',
    'set_document_access',
    'transfer_document_ownership',
    'lock_document',
    'unlock_document',
    'archive_document',
    'restore_document',
    'duplicate_document',
    'restore_document_revision',
  ])('returns Markdown without editor JSON for %s', (name) => {
    const original = JSON.stringify(document);
    const compact = documentResponse(name, original, {});
    expect(JSON.parse(compact)).toEqual({
      id: document.id,
      title: document.title,
      content: document.content,
      version: document.version,
    });
    expect(compact.length).toBeLessThan(original.length / 2);
  });

  it('includes the original editor representation only when explicitly requested', () => {
    const original = JSON.stringify(document);
    expect(documentResponse('get_document', original, { includeContentJson: true })).toBe(original);
    expect(
      JSON.parse(documentResponse('get_document', original, { includeContentJson: false })),
    ).not.toHaveProperty('contentJson');
    expect(JSON.parse(original).contentJson).toEqual(document.contentJson);
  });

  it('preserves non-document results and unsuccessful response shapes', () => {
    const original = JSON.stringify(document);
    expect(isDocumentResponseTool('list_documents')).toBe(false);
    expect(documentResponse('list_documents', original, {})).toBe(original);
    for (const text of ['', 'not JSON', 'null', '[]', '42', '{"error":"Document not found"}']) {
      expect(documentResponse('get_document', text, {})).toBe(text);
    }
  });

  it('adds an optional editor output flag without changing the shared route schema', () => {
    const tool: McpRouteTool = {
      name: 'get_document',
      description: 'Get a document',
      method: 'GET',
      path: '/projects/:projectKey/documents/:documentId',
      pathParams: ['projectKey', 'documentId'],
      hasBody: false,
      inputSchema: {
        type: 'object',
        properties: { projectKey: { type: 'string' }, documentId: { type: 'number' } },
        required: ['projectKey', 'documentId'],
      },
      annotations: { readOnlyHint: true },
      outputSchema: outputSchema({ 200: DocumentResponse }),
      images: false,
    };
    const schema = documentInputSchema(tool);
    expect(schema.properties.includeContentJson).toMatchObject({ type: 'boolean', default: false });
    expect(schema.required).toEqual(['projectKey', 'documentId']);
    expect(tool.inputSchema.properties).not.toHaveProperty('includeContentJson');
    expect(documentInputSchema({ ...tool, name: 'list_documents' })).toBe(tool.inputSchema);

    const output = documentOutputSchema(tool);
    const originalProperties = tool.outputSchema.anyOf[0].properties as {
      data: { required: string[]; properties: Record<string, unknown> };
    };
    const outputProperties = output.anyOf[0].properties as typeof originalProperties;
    expect(outputProperties.data.required).not.toContain('contentJson');
    expect(outputProperties.data.properties.contentJson).toEqual(
      originalProperties.data.properties.contentJson,
    );
    expect(originalProperties.data.required).toContain('contentJson');
    expect(output.anyOf.slice(1)).toEqual(tool.outputSchema.anyOf.slice(1));
    expect(documentOutputSchema({ ...tool, name: 'list_documents' })).toBe(tool.outputSchema);
  });
});
