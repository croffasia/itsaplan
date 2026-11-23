import { MoreHorizontal, RotateCcw, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function DocumentsArchiveRowMenu({
  title,
  pending,
  onRestore,
  onDelete,
}: {
  title: string;
  pending: boolean;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations('documents');

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground"
            aria-label={t('documentActions')}
            title={t('documentActions')}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled={pending} onSelect={onRestore}>
            <RotateCcw />
            {t('restore')}
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            disabled={pending}
            aria-label={t('deletePermanentlyTitle', { title })}
            onSelect={onDelete}
          >
            <Trash2 />
            {t('deletePermanently')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
