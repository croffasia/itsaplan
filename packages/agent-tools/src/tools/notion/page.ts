// Reading a page's shell: its title and its properties. The body of a page is
// markdown on both sides of the API, so only the property objects around it need
// flattening here.

interface RichTextItem {
  plain_text?: string;
  href?: string | null;
  annotations?: { bold?: boolean; italic?: boolean; code?: boolean; strikethrough?: boolean };
}

interface NotionProperty {
  type?: string;
  [key: string]: unknown;
}

// Renders a rich text array as markdown. Comments are read this way; page bodies come
// from Notion already as markdown.
export function fromRichText(items: unknown): string {
  if (!Array.isArray(items)) return '';
  return (items as RichTextItem[])
    .map((item) => {
      let text = item.plain_text ?? '';
      if (!text) return '';
      const marks = item.annotations ?? {};
      if (marks.code) text = `\`${text}\``;
      if (marks.bold) text = `**${text}**`;
      if (marks.italic) text = `*${text}*`;
      if (marks.strikethrough) text = `~~${text}~~`;
      if (item.href) text = `[${text}](${item.href})`;
      return text;
    })
    .join('');
}

// The title property of a page, as POST and PATCH /v1/pages take it. "title" is the id
// every title property carries, so this works whatever the property is named.
export function titleProperty(text: string): Record<string, unknown> {
  return { title: { title: [{ type: 'text', text: { content: text } }] } };
}

// The title of a page: the one property Notion types as "title", whatever it is named.
export function pageTitle(page: Record<string, unknown>): string {
  const properties = (page.properties ?? {}) as Record<string, NotionProperty>;
  for (const property of Object.values(properties)) {
    if (property?.type === 'title') return fromRichText(property.title);
  }
  return '';
}

// A page's properties as plain values, so the agent reads names and dates rather than
// Notion's nested property objects.
export function pageProperties(page: Record<string, unknown>): Record<string, unknown> {
  const properties = (page.properties ?? {}) as Record<string, NotionProperty>;
  const out: Record<string, unknown> = {};
  for (const [name, property] of Object.entries(properties)) {
    out[name] = propertyValue(property);
  }
  return out;
}

function propertyValue(property: NotionProperty): unknown {
  const type = String(property.type ?? '');
  const value = property[type];
  switch (type) {
    case 'title':
    case 'rich_text':
      return fromRichText(value);
    case 'number':
    case 'checkbox':
    case 'url':
    case 'email':
    case 'phone_number':
    case 'created_time':
    case 'last_edited_time':
    case 'date':
      return value ?? null;
    case 'select':
    case 'status':
      return (value as { name?: string } | null)?.name ?? null;
    case 'multi_select':
      return ((value ?? []) as { name?: string }[]).map((option) => option.name ?? '');
    case 'people':
      return ((value ?? []) as { name?: string; id?: string }[]).map((p) => p.name ?? p.id ?? '');
    case 'relation':
      return ((value ?? []) as { id?: string }[]).map((r) => r.id ?? '');
    case 'unique_id': {
      const unique = (value ?? {}) as { prefix?: string | null; number?: number };
      return unique.prefix ? `${unique.prefix}-${unique.number}` : (unique.number ?? null);
    }
    case 'formula': {
      const formula = (value ?? {}) as { type?: string } & Record<string, unknown>;
      return formula[formula.type ?? ''] ?? null;
    }
    default:
      return null;
  }
}
