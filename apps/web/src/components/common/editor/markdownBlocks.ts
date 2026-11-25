export function isElement(node: Node): node is Element {
  return node.nodeType === 1;
}

// A paragraph that is one bold line: how a model writes a heading without a heading mark.
export function isLead(element: Element): boolean {
  return (
    element.tagName === 'P' &&
    element.childNodes.length === 1 &&
    element.firstChild?.nodeName === 'STRONG'
  );
}

// What a code fence holds, or null when the block is not one.
export function codeOf(element: Element): { language: string; text: string } | null {
  const code = element.firstElementChild;
  if (element.tagName !== 'PRE' || code?.tagName !== 'CODE') return null;
  return {
    language: /(?:^|\s)language-(\S+)/.exec(code.className)?.[1] ?? '',
    text: (code.textContent ?? '').replace(/\n$/, ''),
  };
}
