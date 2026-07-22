import type { ReactNode } from 'react';
import { MessagesSquare, Plus, Search } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { useHotkeyLabel } from '@/context/useHotkeys';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { ThemeToggle } from '@/components/theme-toggle';
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
        title={`Search or run a command (${paletteKey})`}
        className="ml-auto flex h-8 max-w-xs min-w-0 flex-1 items-center gap-2 rounded-md border px-3 text-sm text-muted-foreground transition-colors hover:bg-accent"
      >
        <Search className="size-4 shrink-0" />
        <span className="hidden truncate sm:inline">Search or run a command…</span>
        <kbd className="ml-auto hidden rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] sm:inline">
          {paletteKey}
        </kbd>
      </button>

      <Button
        variant="outline"
        size="icon"
        className="size-8 shrink-0"
        title={`New issue (${newIssueKey})`}
        disabled={!canCreateIssue}
        onClick={onNewIssue}
      >
        <Plus />
      </Button>

      {canUseChat && (
        <Button
          variant={chatActive ? 'default' : 'outline'}
          size="icon"
          className="size-8 shrink-0"
          title="AI chat"
          aria-pressed={chatActive}
          onClick={onToggleChat}
        >
          <MessagesSquare />
        </Button>
      )}

      <ThemeToggle />
      <UserMenu />
    </header>
  );
}
