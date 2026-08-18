import json from 'highlight.js/lib/languages/json';
import { createLowlight } from 'lowlight';
import type { ReactNode } from 'react';

// Highlighting for the JSON a chat shows. Registering the one grammar keeps the rest of
// highlight.js out of the bundle; the `hljs-*` class names it emits are coloured by the
// `.md-content` palette in globals.css, so a block has to be rendered inside it.

const lowlight = createLowlight({ json });

// What lowlight returns: a highlighted block is made of text and of spans carrying the
// `hljs-*` classes, nothing else.
type HastNode =
  | { type: 'text'; value: string }
  | { type: 'element'; properties?: { className?: string[] }; children: HastNode[] };

// The value indented and highlighted, or null when it is not JSON — a tool that
// answered in plain text is shown as it wrote it.
export function highlightJson(value: string): ReactNode | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  const tree = lowlight.highlight('json', JSON.stringify(parsed, null, 2));
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
