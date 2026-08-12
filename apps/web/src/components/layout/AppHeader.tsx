import type { ReactNode } from 'react';
import { MessagesSquare, Plus, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { usePermissions } from '@/hooks/usePermissions';
import { useHotkeyLabel } from '@/context/useHotkeys';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { ThemeToggle } from '@/components/theme-toggle';
import { LocaleToggle } from '@/components/locale-toggle';
import UserMenu from '@/components/layout/UserMenu';

// The slim header inside the sidebar inset, shared by the project view and the
// settings pages.
export default function AppHeader({
  title,
  hasProject,
  onOpenCommand,
  onNewIssue,
  chatActive,
  onToggleChat,
}: {
  title: ReactNode;
  hasProject: boolean;
  onOpenCommand: () => void;
  onNewIssue: () => void;
  chatActive: boolean;
  onToggleChat: () => void;
}) {
  const t = useTranslations('nav');
  const { can } = usePermissions();
  const paletteKey = useHotkeyLabel('palette.toggle');
  const newIssueKey = useHotkeyLabel('issue.new');
  const canCreateIssue = hasProject && can('work_items', 'create');
  const canUseChat = hasProject && can('ai_agents', 'read');
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-2 sm:px-4">
      <SidebarTrigger />
      <Separator orientation="vertical" className="mr-1 h-4" />
      <div className="min-w-0 truncate text-sm font-medium">{title}</div>

      <button
        type="button"
        onClick={onOpenCommand}
        title={t('searchHint', { key: paletteKey ?? '' })}
        className="ml-auto flex size-8 shrink-0 items-center justify-center rounded-md border text-sm text-muted-foreground transition-colors hover:bg-accent sm:w-auto sm:max-w-xs sm:min-w-0 sm:flex-1 sm:shrink sm:justify-start sm:gap-2 sm:px-3"
      >
        <Search className="size-4 shrink-0" />
        <span className="hidden truncate sm:inline">{t('search')}</span>
        <kbd className="ml-auto hidden rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] sm:inline">
          {paletteKey}
        </kbd>
      </button>

      {canCreateIssue && (
        <Button
          variant="outline"
          size="icon"
          className="size-8 shrink-0"
          title={t('newIssueHint', { key: newIssueKey ?? '' })}
          onClick={onNewIssue}
        >
          <Plus />
        </Button>
      )}

      {canUseChat && (
        <Button
          variant={chatActive ? 'default' : 'outline'}
          size="icon"
          className="size-8 shrink-0"
          title={t('aiChat')}
          aria-pressed={chatActive}
          onClick={onToggleChat}
        >
          <MessagesSquare />
        </Button>
      )}

      <LocaleToggle />
      <ThemeToggle />
      <UserMenu />
    </header>
  );
}
