import { GitPullRequest, Link2, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function IssueDevelopmentAddMenu({
  onLink,
  onCreate,
}: {
  onLink: () => void;
  onCreate: () => void;
}) {
  const t = useTranslations('issue.development');
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-muted-foreground">
          <Plus className="size-3.5" />
          {t('add')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
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
