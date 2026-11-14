import { BookText, Pencil, Trash2, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { AgentSkill } from '@/lib/api/endpoints/agentSkills';
import GithubIcon from '@/components/common/GithubIcon';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { ClampedDescription } from '../ClampedDescription';

const SOURCE_ICON = { github: GithubIcon, upload: Upload, inline: BookText };

const CELL = 'px-3 py-3 align-middle whitespace-normal';

// One skill as a table row. A click on the row opens the editor.
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
  const t = useTranslations('teams.skills');
  const SourceIcon = SOURCE_ICON[skill.source];
  const sourceLabel = t(`source.${skill.source}`);
  const refCount = skill.files.length;

  return (
    <TableRow
      className={cn('group/item', canEdit && 'cursor-pointer')}
      onClick={canEdit ? onEdit : undefined}
    >
      <TableCell className={CELL}>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
            <span title={sourceLabel} className="shrink-0 text-muted-foreground">
              <SourceIcon className="size-3.5" aria-hidden />
            </span>
            <span className="sr-only">{sourceLabel}</span>
            <span className="truncate">{skill.name}</span>
          </span>
          {refCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {t('referenceCount', { count: refCount })}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className={CELL}>
        {skill.description ? (
          <ClampedDescription text={skill.description} className="text-sm" />
        ) : (
          <span className="text-sm text-muted-foreground">{t('noDescription')}</span>
        )}
      </TableCell>
      <TableCell className="px-3 py-2 align-middle" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1">
          {canEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-foreground"
              onClick={onEdit}
              aria-label={t('editLabel', { name: skill.name })}
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
              aria-label={t('deleteLabel', { name: skill.name })}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
