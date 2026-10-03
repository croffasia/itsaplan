import Link from 'next/link';
import { Settings2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { WorkspaceSummary } from '@/lib/api/endpoints/workspaces';
import { workspacePath } from '@/utils/paths';
import { Button } from '@/components/ui/button';

export default function ProjectSwitcherWorkspaceHeader({
  workspace,
  onClose,
}: {
  workspace: WorkspaceSummary;
  onClose: () => void;
}) {
  const t = useTranslations('nav');
  const tw = useTranslations('teams.workspace');

  return (
    <div className="flex h-10 shrink-0 items-center gap-2 border-b ps-3 pe-1.5">
      <span dir="auto" className="min-w-0 truncate text-[13px] font-semibold">
        {workspace.name}
      </span>
      {workspace.role && (
        <>
          <span className="shrink-0 text-xs text-muted-foreground">
            {tw(`roles.${workspace.role}`)}
          </span>
          <Button asChild variant="ghost" size="icon-xs" className="ms-auto text-muted-foreground">
            <Link
              href={workspacePath(workspace.id)}
              aria-label={t('projectPicker.workspaceSettings')}
              onClick={onClose}
            >
              <Settings2 />
            </Link>
          </Button>
        </>
      )}
    </div>
  );
}
