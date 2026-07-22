import { Check, ExternalLink } from 'lucide-react';
import { type CustomField, type Issue } from '@/lib/api';
import { formatShortDate } from '@/utils/dates';
import { colorDot } from '@/components/common/fields/colorDot';
import { MarkdownCell } from './MarkdownCell';

const DASH = <span className="text-muted-foreground/40">—</span>;

// Compact plain-text preview of a long text/markdown value: newlines collapsed,
// clipped so a whole post (with embedded media) never lands in the cell.
function preview(value: unknown): string {
  return String(value).replace(/\s+/g, ' ').trim().slice(0, 200);
}

// One custom-field value cell. Reads the issue's entry for the field; an issue
// whose type doesn't have this field (or has it unset) shows a dash.
export function TableCustomCell({ field, issue }: { field: CustomField; issue: Issue }) {
  const entry = issue.fieldValues.find((v) => v.fieldId === field.id);

  if (field.fieldType === 'select' || field.fieldType === 'multi_select') {
    const options = (entry?.optionIds ?? []).flatMap(
      (id) => field.options.find((o) => o.id === id) ?? [],
    );
    if (options.length === 0) return <div>{DASH}</div>;
    return (
      <div className="flex min-w-0 flex-wrap items-center gap-1 text-xs">
        {options.map((o) => (
          <span key={o.id} className="flex min-w-0 items-center gap-1">
            {colorDot(o.color)}
            <span className="truncate">{o.value}</span>
          </span>
        ))}
      </div>
    );
  }

  if (field.fieldType === 'boolean') {
    return (
      <div className="text-muted-foreground">
        {entry?.value === true ? <Check className="size-3.5" /> : DASH}
      </div>
    );
  }

  const raw = entry?.value;
  if (raw == null || raw === '') return <div>{DASH}</div>;
  if (field.fieldType === 'date')
    return <div className="text-xs text-muted-foreground">{formatShortDate(String(raw))}</div>;
  // Url fields render as a link that opens in a new tab; stopPropagation so the
  // click follows the link instead of opening the issue row behind it.
  if (field.fieldType === 'url') {
    return (
      <a
        href={String(raw)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="inline-flex min-w-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ExternalLink className="size-3 shrink-0" />
        <span className="truncate">{preview(raw)}</span>
      </a>
    );
  }
  // Markdown fields render their full content (formatted), not a text preview.
  // breaks:true so a single newline becomes a line break, matching the
  // MarkdownEditor used in the issue detail (tiptap-markdown breaks:true).
  if (field.fieldType === 'markdown') {
    return <MarkdownCell value={String(raw)} />;
  }
  return <div className="truncate text-xs text-muted-foreground">{preview(raw)}</div>;
}
