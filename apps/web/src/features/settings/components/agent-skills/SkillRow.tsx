import { BookText, Pencil, Trash2 } from 'lucide-react';
import type { AgentSkill } from '@/lib/api';
import GithubIcon from '@/components/common/GithubIcon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import { useTranslations } from 'next-intl';

// One skill as a table row: name and source with the reference-file count below, the
// description, and edit/delete actions gated by permission.
export function SkillRow({
  skill,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: {
  skill: AgentSkill;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations('settings.skills');
  const refCount = skill.files.length;
  return (
    <TableRow className="group/item">
      <TableCell className="px-3 py-3 align-top whitespace-normal">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            {skill.source === 'github' ? (
              <GithubIcon className="size-4" />
            ) : (
              <BookText className="size-4" />
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-1 pt-0.5">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="truncate text-sm font-medium text-foreground">{skill.name}</span>
              <Badge variant="outline" className="text-[10px] font-medium tracking-wide uppercase">
                {t(`source.${skill.source}`)}
              </Badge>
            </div>
            {refCount > 0 && (
              <span className="text-xs text-muted-foreground">
                {t('referenceCount', { count: refCount })}
              </span>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell className="px-3 py-3 pt-4 align-top whitespace-normal">
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {skill.description || t('noDescription')}
        </p>
      </TableCell>
      <TableCell className="px-3 py-2 pt-3 align-top">
        <div className="flex items-center justify-end gap-1">
          {canEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-foreground"
              onClick={onEdit}
              aria-label={t('edit')}
            >
              <Pencil className="size-4" />
            </Button>
          )}
          {canDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-destructive"
              onClick={onDelete}
              aria-label={t('delete')}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
