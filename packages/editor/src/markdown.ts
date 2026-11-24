import { getSchema } from '@tiptap/core';
import { DOMParser } from '@tiptap/pm/model';
import MarkdownIt from 'markdown-it';
import { documentExtensions, TightLists } from './document';
import { markMentions } from './mention';
import { splitTaskLists, useTaskLists } from './task-list';

// The editor JSON of a page written as Markdown, read the way the web editor reads it:
// tiptap-markdown with html:true, linkify and breaks, and the parse hooks of
// documentExtensions in their order. The caller passes the DOM to parse with: the api
// has no DOM of its own.

const schema = getSchema([...documentExtensions(), TightLists]);

const markdown = MarkdownIt({ html: true, linkify: true, breaks: true }).set({
  langPrefix: 'language-',
});
useTaskLists(markdown);
// tiptap-markdown drops the newline markdown-it ends a rendered tag with, except a soft break.
const withoutNewLine =
  <A extends unknown[]>(render: (...args: A) => string) =>
  (...args: A) => {
    const rendered = render(...args);
    return rendered !== '\n' && rendered.endsWith('\n') ? rendered.slice(0, -1) : rendered;
  };
const { rules } = markdown.renderer;
rules.hardbreak = withoutNewLine(rules.hardbreak!);
rules.softbreak = withoutNewLine(rules.softbreak!);
rules.fence = withoutNewLine(rules.fence!);
rules.code_block = withoutNewLine(rules.code_block!);
markdown.renderer.renderToken = withoutNewLine(
  markdown.renderer.renderToken.bind(markdown.renderer),
);

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

// Moves a block that markdown-it left inside a paragraph (a raw <img> or <table>) out
// of it, splitting the paragraph around it.
function extractElement(node: Element) {
  const parent = node.parentElement!;
  const prepend = parent.cloneNode() as Element;
  while (parent.firstChild && parent.firstChild !== node) prepend.appendChild(parent.firstChild);
  if (prepend.childNodes.length > 0) parent.parentElement!.insertBefore(prepend, parent);
  parent.parentElement!.insertBefore(node, parent);
  if (parent.childNodes.length === 0) parent.remove();
}

const blockSelector = Object.values(schema.nodes)
  .filter((node) => node.isBlock)
  .flatMap((node) => node.spec.parseDOM?.map((rule) => rule.tag) ?? [])
  .filter(Boolean)
  .join(',');

function removeWhitespaces(node: HTMLElement): HTMLElement {
  const children = node.childNodes;
  for (let i = children.length - 1; i >= 0; i -= 1) {
    const child = children[i]!;
    if (child.nodeType === TEXT_NODE && child.nodeValue && /^(\n\s\s|\n)$/.test(child.nodeValue))
      node.removeChild(child);
    else if (child.nodeType === ELEMENT_NODE) removeWhitespaces(child as HTMLElement);
  }
  return node;
}

export function markdownToDocumentJson(
  content: string,
  window: { DOMParser: typeof globalThis.DOMParser },
): Record<string, unknown> {
  const parseBody = (html: string) =>
    new window.DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body;
  const body = parseBody(markdown.render(content));
  body.innerHTML = body.innerHTML.replace(/\n<\/code><\/pre>/g, '</code></pre>');
  splitTaskLists(body);
  for (const item of body.querySelectorAll('.task-list-item')) {
    const input = item.querySelector('input');
    item.setAttribute('data-type', 'taskItem');
    if (input) {
      item.setAttribute('data-checked', String(input.checked));
      input.remove();
    }
  }
  markMentions(body);
  for (const element of body.querySelectorAll(blockSelector))
    if (element.parentElement?.matches('p')) extractElement(element);
  for (const element of body.querySelectorAll('*')) {
    const next = element.nextSibling;
    if (next?.nodeType === TEXT_NODE && !element.closest('pre'))
      next.textContent = next.textContent!.replace(/^\n/, '');
  }
  return DOMParser.fromSchema(schema)
    .parse(removeWhitespaces(parseBody(body.innerHTML)))
    .toJSON();
}
