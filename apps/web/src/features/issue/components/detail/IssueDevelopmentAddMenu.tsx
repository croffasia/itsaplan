import { type ReactNode } from 'react';
import { GitPullRequest, Link2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Links an existing pull request or creates one. The Development heading and the
// issue's add bar open it from their own triggers.
export default function IssueDevelopmentAddMenu({
  trigger,
  align = 'end',
  onLink,
  onCreate,
}: {
  trigger: ReactNode;
  align?: 'start' | 'end';
  onLink: () => void;
  onCreate: () => void;
}) {
  const t = useTranslations('issue.development');
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-52">
        <DropdownMenuItem onSelect={onLink}>
          <Link2 />
          {t('linkExisting')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onCreate}>
          <GitPullRequest />
          {t('createPullRequest')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
