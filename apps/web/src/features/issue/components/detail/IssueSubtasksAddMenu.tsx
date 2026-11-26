import { type ReactNode } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslations } from 'next-intl';

// Adds a subtask: a new issue through the create modal, or an existing one through
// the search dialog. The Subtasks heading and the issue's add bar open it from their
// own triggers.
export default function IssueSubtasksAddMenu({
  trigger,
  align = 'end',
  canCreate,
  onCreate,
  onAttach,
}: {
  trigger: ReactNode;
  align?: 'start' | 'end';
  canCreate: boolean;
  onCreate: () => void;
  onAttach: () => void;
}) {
  const t = useTranslations('issue.subtasks');
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-44">
        {canCreate && <DropdownMenuItem onSelect={onCreate}>{t('newSubtask')}</DropdownMenuItem>}
        <DropdownMenuItem onSelect={onAttach}>{t('existingIssue')}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
