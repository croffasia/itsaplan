import { internalLinkTarget } from '@/components/common/editor/internalLinkTarget';

// The links in a run's answer that lead to an issue, a document or another page of this
// workspace: an agent usually answers with the item it wrote.
export function runLinks(output: string, origin: string): string[] {
  const links = new Set<string>();
  for (const [match] of output.matchAll(/https?:\/\/[^\s<>()[\]"'`]+/g)) {
    const href = withoutTrailingPunctuation(match);
    if (!URL.canParse(href)) continue;
    const url = new URL(href);
    if (url.origin === origin && internalLinkTarget(url)) links.add(url.href);
  }
  return [...links];
}

// A loop, not /[.,;:!?]+$/: that regex retries from every punctuation mark and takes
// quadratic time on a long run of them, which an agent's answer can hold.
function withoutTrailingPunctuation(text: string): string {
  let end = text.length;
  while (end > 0 && '.,;:!?'.includes(text[end - 1])) end--;
  return text.slice(0, end);
}
