import { createElement } from 'react';

const MARKDOWN_TAGS = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'blockquote',
  'pre',
  'hr',
  'div',
]);

// One block of rendered markdown, as the element it is. Raw HTML of any other kind stays in a
// wrapper: React moves a `<title>` to the head and throws on a `<textarea>` with content.
export default function MarkdownBlock({
  element,
  className,
}: {
  element: Element;
  className?: string;
}) {
  if (!MARKDOWN_TAGS.has(element.localName)) {
    return <div dangerouslySetInnerHTML={{ __html: element.outerHTML }} />;
  }
  return createElement(element.localName, {
    className,
    // Set on the node because a raw HTML block carries attributes under names React does not take.
    ref: (node: Element | null) => {
      for (const { name, value } of element.attributes) node?.setAttribute(name, value);
    },
    dangerouslySetInnerHTML: element.innerHTML ? { __html: element.innerHTML } : undefined,
  });
}
