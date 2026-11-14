import type { IntegrationMeta } from '@/lib/api/endpoints/integrations';

export interface ToolOption {
  toolKey: string;
  label: string;
  // The label inside its integration's list, without the integration's name in front.
  name: string;
  description: string;
  // OAuth scopes the credential's token must carry for this tool (may be empty).
  scopes: string[];
  group: string | null;
}

export interface ToolIntegration {
  key: string;
  label: string;
  icon?: IntegrationMeta['icon'];
  website?: string;
  // Its tools are added on a credential, or with none when it is optional.
  takesCredential: boolean;
  needsCredential: boolean;
  tools: ToolOption[];
}

export interface ToolSection {
  group: string | null;
  tools: ToolOption[];
}

// The tool integrations of the catalog that offer a tool. An integration with none
// only stores credentials for another feature.
export function toolIntegrations(catalog: IntegrationMeta[]): ToolIntegration[] {
  return catalog
    .filter((i) => i.kind === 'tool' && i.tools.length > 0)
    .map((i) => ({
      key: i.key,
      label: i.label,
      icon: i.icon,
      website: i.website,
      takesCredential: i.credentialSchema.length > 0,
      needsCredential: i.credentialSchema.length > 0 && !i.credentialOptional,
      tools: i.tools.map((tool) => ({
        toolKey: tool.key,
        label: tool.label,
        name: tool.label.startsWith(`${i.label} `)
          ? tool.label.slice(i.label.length + 1)
          : tool.label,
        description: tool.description,
        scopes: tool.scopes ?? [],
        group: tool.group ?? null,
      })),
    }));
}

// The tools of an integration a search leaves. A query that matches the integration's
// name keeps all of them.
export function matchingTools(integration: ToolIntegration, query: string): ToolOption[] {
  const q = query.trim().toLowerCase();
  if (!q || integration.label.toLowerCase().includes(q)) return integration.tools;
  return integration.tools.filter(
    (o) =>
      o.label.toLowerCase().includes(q) ||
      o.description.toLowerCase().includes(q) ||
      o.scopes.some((s) => s.toLowerCase().includes(q)),
  );
}

// Tools split by group in catalog order, the tools with no group first.
export function toolSections(tools: ToolOption[]): ToolSection[] {
  const sections: ToolSection[] = [];
  for (const tool of tools) {
    const section = sections.find((s) => s.group === tool.group);
    if (section) section.tools.push(tool);
    else sections.push({ group: tool.group, tools: [tool] });
  }
  return sections.sort((a, b) => Number(a.group !== null) - Number(b.group !== null));
}
