import { common, createLowlight } from 'lowlight';
import type { ReactNode } from 'react';

// Highlighting for what a chat shows: the JSON of a tool call and whatever code a tool
// answered with. The `hljs-*` class names lowlight emits are coloured by the `.md-content`
// palette in globals.css, so a block has to be rendered inside it.

const lowlight = createLowlight(common);

// What lowlight returns: a highlighted block is made of text and of spans carrying the
// `hljs-*` classes, nothing else.
type HastNode =
  | { type: 'text'; value: string }
  | { type: 'element'; properties?: { className?: string[] }; children: HastNode[] };

const DIFF_HEADER = /^(diff --git |@@ |--- |\+\+\+ )/m;

// Below this, highlight.js's guess rests on a few punctuation marks, which is what prose and
// command output score — those stay plain.
const MIN_RELEVANCE = 5;

// The value highlighted, or null when it is not code — a tool that answered in prose is
// shown as it wrote it.
export function highlight(value: string): ReactNode | null {
  const indented = indentJson(value);
  if (indented !== null) return render(lowlight.highlight('json', indented));
  if (looksLikeDiff(value)) return render(lowlight.highlight('diff', value));

  const auto = lowlight.highlightAuto(value);
  if ((auto.data?.relevance ?? 0) < MIN_RELEVANCE) return null;
  return render(auto);
}

// The value highlighted as a known language (a name or an alias such as a file
// extension: "ts", "py", "yml"), or null when lowlight does not carry it.
export function highlightAs(language: string, value: string): ReactNode | null {
  if (!lowlight.registered(language)) return null;
  return render(lowlight.highlight(language, value));
}

function indentJson(value: string): string | null {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return null;
  }
}

// A header is enough on its own; without one, a diff still has to both add and remove a line,
// so that a markdown list is not taken for one.
function looksLikeDiff(value: string): boolean {
  if (DIFF_HEADER.test(value)) return true;
  const lines = value.split('\n');
  return lines.some((line) => line.startsWith('+')) && lines.some((line) => line.startsWith('-'));
}

function render(tree: { children: unknown[] }): ReactNode {
  return toNodes(tree.children as HastNode[]);
}

function toNodes(nodes: HastNode[]): ReactNode {
  return nodes.map((node, index) => {
    if (node.type === 'text') return node.value;
    return (
      <span key={index} className={node.properties?.className?.join(' ')}>
        {toNodes(node.children)}
      </span>
    );
  });
}
