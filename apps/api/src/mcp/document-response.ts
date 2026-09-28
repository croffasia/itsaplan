import type { McpInputSchema, McpRouteTool } from './generate';
import type { McpOutputSchema } from './result';

const documentResponseTools = new Set([
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
]);

export function isDocumentResponseTool(toolName: string): boolean {
  return documentResponseTools.has(toolName);
}

export function documentInputSchema(tool: McpRouteTool): McpInputSchema {
  if (!isDocumentResponseTool(tool.name)) return tool.inputSchema;
  return {
    ...tool.inputSchema,
    properties: {
      ...tool.inputSchema.properties,
      includeContentJson: {
        type: 'boolean',
        default: false,
        description:
          'Include editor JSON alongside Markdown only when rich-text structure is needed. Markdown is returned by default.',
      },
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// The route's success schema requires contentJson, which a Markdown-only result leaves out.
export function documentOutputSchema(tool: McpRouteTool): McpOutputSchema {
  if (!isDocumentResponseTool(tool.name)) return tool.outputSchema;
  return {
    ...tool.outputSchema,
    anyOf: tool.outputSchema.anyOf.map((branch) => {
      const properties = branch.properties;
      if (
        !isRecord(properties) ||
        !isRecord(properties.ok) ||
        properties.ok.const !== true ||
        !isRecord(properties.data) ||
        !Array.isArray(properties.data.required)
      ) {
        return branch;
      }
      return {
        ...branch,
        properties: {
          ...properties,
          data: {
            ...properties.data,
            required: properties.data.required.filter((name) => name !== 'contentJson'),
          },
        },
      };
    }),
  };
}

export function documentResponse(
  toolName: string,
  text: string,
  args: Record<string, unknown>,
): string {
  if (!isDocumentResponseTool(toolName) || args.includeContentJson === true) return text;
  let document: unknown;
  try {
    document = JSON.parse(text);
  } catch {
    return text;
  }
  if (!isRecord(document)) return text;
  const { contentJson: _contentJson, ...markdownDocument } = document;
  return JSON.stringify(markdownDocument);
}
