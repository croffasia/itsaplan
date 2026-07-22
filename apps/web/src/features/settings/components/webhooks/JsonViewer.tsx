import { useState } from 'react';
import { Check, ChevronDown, ChevronRight, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

// A lightweight, monochrome JSON tree viewer. Objects and arrays collapse/expand;
// leaves render inline. Accepts an object or a string that contains JSON (parsed
// on the fly); a non-JSON string is shown as raw text. A copy button copies the
// pretty-printed JSON.
export function JsonViewer({ value }: { value: unknown }) {
  const { data, isJson } = normalize(value);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(isJson ? safeStringify(data) : String(data));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (insecure context / denied).
    }
  }

  return (
    <div className="group/json relative">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-1.5 right-1.5 z-10 size-6 text-muted-foreground opacity-0 group-hover/json:opacity-100 hover:text-foreground"
        title="Copy"
        onClick={copy}
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </Button>
      <div className="max-h-72 overflow-auto rounded-md bg-muted/50 p-2 pr-8 font-mono text-[11px] leading-relaxed">
        {isJson ? (
          <JsonNode value={data} depth={0} isLast />
        ) : (
          <pre className="break-all whitespace-pre-wrap">{String(data)}</pre>
        )}
      </div>
    </div>
  );
}

function JsonNode({
  value,
  name,
  depth,
  isLast,
}: {
  value: unknown;
  name?: string;
  depth: number;
  isLast: boolean;
}) {
  const [open, setOpen] = useState(depth < 2);
  const indent = { paddingLeft: `${depth * 14}px` };
  const keyEl =
    name != null ? <span className="text-foreground">{JSON.stringify(name)}: </span> : null;
  const comma = isLast ? '' : ',';

  const collapsible = value !== null && typeof value === 'object';
  if (!collapsible) {
    return (
      <div className="flex" style={indent}>
        <span className="w-3.5 shrink-0" aria-hidden />
        <span className="break-all">
          {keyEl}
          <Leaf value={value} />
          {comma}
        </span>
      </div>
    );
  }

  const isArr = Array.isArray(value);
  const entries: [string, unknown][] = isArr
    ? (value as unknown[]).map((v, i) => [String(i), v])
    : Object.entries(value as Record<string, unknown>);
  const openBr = isArr ? '[' : '{';
  const closeBr = isArr ? ']' : '}';

  return (
    <div>
      <div
        className="flex cursor-pointer rounded hover:bg-accent/40"
        style={indent}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="flex w-3.5 shrink-0 items-center text-muted-foreground">
          {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        </span>
        <span className="break-all">
          {keyEl}
          <span className="text-muted-foreground/70">{openBr}</span>
          {!open && (
            <span className="text-muted-foreground/50">
              {entries.length > 0 ? ` ${entries.length} ` : ''}
              <span className="text-muted-foreground/70">{closeBr}</span>
              {comma}
            </span>
          )}
        </span>
      </div>
      {open && (
        <>
          {entries.map(([k, v], i) => (
            <JsonNode
              key={k}
              name={isArr ? undefined : k}
              value={v}
              depth={depth + 1}
              isLast={i === entries.length - 1}
            />
          ))}
          <div className="flex" style={indent}>
            <span className="w-3.5 shrink-0" aria-hidden />
            <span className="text-muted-foreground/70">
              {closeBr}
              {comma}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function Leaf({ value }: { value: unknown }) {
  if (typeof value === 'string')
    return <span className="text-muted-foreground">&quot;{value}&quot;</span>;
  if (value === null) return <span className="text-muted-foreground/50">null</span>;
  return <span className="text-foreground/80">{String(value)}</span>;
}

// Object -> tree. String -> parsed tree if it is JSON, otherwise raw text.
function normalize(value: unknown): { data: unknown; isJson: boolean } {
  if (typeof value === 'string') {
    try {
      return { data: JSON.parse(value), isJson: true };
    } catch {
      return { data: value, isJson: false };
    }
  }
  return { data: value, isJson: true };
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
