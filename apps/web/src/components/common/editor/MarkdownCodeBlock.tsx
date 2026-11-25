import { useMemo } from 'react';
import { highlightAs } from '@/lib/highlight';
import CopyButton from '@/components/common/CopyButton';

// A fence still being written stays plain: highlighting the whole of it on every streamed
// token is slow.
export default function MarkdownCodeBlock({
  language,
  text,
  writing,
}: {
  language: string;
  text: string;
  writing: boolean;
}) {
  const highlighted = useMemo(
    () => (writing ? null : highlightAs(language, text)),
    [language, text, writing],
  );

  return (
    <div dir="ltr" className="md-code rounded-lg bg-muted/70">
      <div
        data-code-bar=""
        className="flex items-center justify-between ps-3.5 pe-2 pt-1.5 font-mono text-xs text-muted-foreground select-none"
      >
        <span>{language}</span>
        <CopyButton text={text} />
      </div>
      <pre>
        <code>{highlighted ?? text}</code>
      </pre>
    </div>
  );
}
