import { useRouter } from 'next/navigation';
import { Target } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useInitiativeSearchQuery } from '@/services/initiatives.service';
import { initiativePath } from '@/utils/paths';
import { INITIATIVE_PREFIX } from '@/utils/commandFilter';
import { CommandGroup, CommandItem, CommandSeparator } from '@/components/ui/command';

// The initiatives whose title matches, the open project's first. projectId null
// searches every project the user can read initiatives in.
export default function CommandPaletteInitiatives({
  query,
  projectId,
  currentProjectId,
  enabled,
  onClose,
}: {
  query: string;
  projectId: number | null;
  currentProjectId: number | null;
  enabled: boolean;
  onClose: () => void;
}) {
  const t = useTranslations('palette');
  const router = useRouter();
  const search = useInitiativeSearchQuery(query, projectId, { enabled });
  const hits = [...(search.data ?? [])].sort(
    (a, b) => Number(b.projectId === currentProjectId) - Number(a.projectId === currentProjectId),
  );
  if (!enabled || (!hits.length && !search.isFetching)) return null;
  return (
    <>
      <CommandSeparator />
      <CommandGroup heading={t('initiatives')}>
        {!hits.length && (
          <CommandItem value={`${INITIATIVE_PREFIX}loading`} disabled>
            <Target />
            <span className="text-muted-foreground">{t('searching')}</span>
          </CommandItem>
        )}
        {hits.map((hit, i) => (
          <CommandItem
            key={hit.id}
            value={`${INITIATIVE_PREFIX}${i}`}
            onSelect={() => {
              onClose();
              router.push(initiativePath(hit.projectRef, hit.id));
            }}
          >
            <Target />
            <span className="flex-1 truncate" dir="auto">
              {hit.title}
            </span>
            <span className="shrink-0 font-mono text-xs text-muted-foreground" dir="ltr">
              {hit.projectKey}
            </span>
          </CommandItem>
        ))}
      </CommandGroup>
    </>
  );
}
