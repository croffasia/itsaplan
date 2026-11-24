import { useState } from 'react';
import type { Editor } from '@tiptap/react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

// The link field the selection menu swaps its buttons for. An empty address removes
// the link.
export default function EditorLinkForm({ editor, onDone }: { editor: Editor; onDone: () => void }) {
  const t = useTranslations('common.editor');
  const [url, setUrl] = useState(() => (editor.getAttributes('link').href as string) ?? '');

  return (
    <form
      className="flex items-center gap-1"
      onSubmit={(event) => {
        event.preventDefault();
        const href = url.trim();
        const chain = editor.chain().focus().extendMarkRange('link');
        if (href) chain.setLink({ href }).run();
        else chain.unsetLink().run();
        onDone();
      }}
    >
      <input
        type="text"
        inputMode="url"
        dir="ltr"
        autoFocus
        value={url}
        aria-label={t('linkUrl')}
        placeholder={t('linkPlaceholder')}
        onChange={(event) => setUrl(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return;
          event.preventDefault();
          event.stopPropagation();
          onDone();
          editor.commands.focus();
        }}
        className="h-7.5 w-60 min-w-0 rounded-md bg-muted px-2 text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
      />
      <Button type="submit" size="sm" className="h-7">
        {t('applyLink')}
      </Button>
    </form>
  );
}
