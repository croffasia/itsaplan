import { useState } from 'react';
import { useIconHover } from '@animateicons/react';
import { PlusIcon } from '@animateicons/react/lucide/plus-icon';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import ToolbarIconButton from '@/components/layout/ToolbarIconButton';

const REVEAL = 'opacity-0 group-hover/add:opacity-100 focus-visible:opacity-100';

// Shows while the pointer is over the nearest `group/add` ancestor: a column or a
// day. Enter creates the issue and keeps the input open for the next one.
export function CalendarQuickAdd({
  onAdd,
  compact = false,
}: {
  onAdd: (title: string) => Promise<void>;
  // An icon instead of a full-width button, for a month cell.
  compact?: boolean;
}) {
  const t = useTranslations('workItems.calendar');
  const tIssue = useTranslations('issue');
  const { ref, triggerProps } = useIconHover();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);

  const close = () => {
    setOpen(false);
    setTitle('');
  };

  async function submit() {
    const value = title.trim();
    if (!value || saving) return;
    setSaving(true);
    try {
      await onAdd(value);
      setTitle('');
    } catch {
      // The MutationCache toasts the failure. The title stays for another try.
    } finally {
      setSaving(false);
    }
  }

  if (open) {
    return (
      <Input
        autoFocus
        value={title}
        placeholder={tIssue('titlePlaceholder')}
        aria-busy={saving}
        className={cn('md:text-xs', compact ? 'h-5 flex-1 px-1 py-0' : 'h-8 shrink-0')}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={close}
        onKeyDown={(e) => {
          if (e.key === 'Escape') close();
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) void submit();
        }}
      />
    );
  }

  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <ToolbarIconButton
            icon={PlusIcon}
            className={cn('p-0.5', REVEAL)}
            onClick={() => setOpen(true)}
            aria-label={t('addWorkItem')}
          />
        </TooltipTrigger>
        <TooltipContent>{t('addWorkItem')}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      {...triggerProps}
      className={cn('w-full shrink-0 text-muted-foreground', REVEAL)}
      onClick={() => setOpen(true)}
    >
      <PlusIcon ref={ref} size={16} />
      {t('addWorkItem')}
    </Button>
  );
}
