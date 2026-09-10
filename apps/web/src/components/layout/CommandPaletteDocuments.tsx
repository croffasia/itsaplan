import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { FileText, LockKeyhole } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { listDocuments } from '@/lib/api/endpoints/documents';
import { qk } from '@/services/queryKeys';
import { usePermissions } from '@/hooks/usePermissions';
import { useProjectFeatures } from '@/hooks/useProjectFeatures';
import { useRecentDocuments } from '@/hooks/useDocumentNavigation';
import { documentPath } from '@/utils/paths';
import { DOCUMENT_PREFIX } from '@/utils/commandFilter';
import { CommandGroup, CommandItem, CommandSeparator } from '@/components/ui/command';

export default function CommandPaletteDocuments({
  projectKey,
  query,
  enabled,
  onClose,
}: {
  projectKey: string | null;
  query: string;
  enabled: boolean;
  onClose: () => void;
}) {
  const t = useTranslations('documents');
  const router = useRouter();
  const { can } = usePermissions();
  const features = useProjectFeatures();
  const recent = useRecentDocuments(projectKey);
  const allowed = features.documents && can('documents', 'read');
  const result = useQuery({
    queryKey: qk.documents(projectKey ?? '', query),
    queryFn: () => listDocuments(projectKey!, query || undefined),
    enabled: enabled && allowed && projectKey !== null,
    staleTime: 30_000,
  });
  if (!enabled || !allowed || !projectKey) return null;
  const documents = result.data ?? [];
  const hits = query
    ? documents.slice(0, 12)
    : documents
        .filter((item) => recent.ids.includes(item.id) || item.isFavorite)
        .sort((a, b) => {
          const ai = recent.ids.indexOf(a.id);
          const bi = recent.ids.indexOf(b.id);
          return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
        })
        .slice(0, 8);
  if (!hits.length && !result.isFetching && !result.isError) return null;
  return (
    <>
      <CommandSeparator />
      <CommandGroup heading={query ? t('title') : t('recentAndFavorites')}>
        {result.isError && (
          <CommandItem value={`${DOCUMENT_PREFIX}error`} onSelect={() => void result.refetch()}>
            {t('loadFailed')}
          </CommandItem>
        )}
        {!hits.length && result.isFetching && (
          <CommandItem value={`${DOCUMENT_PREFIX}loading`} disabled>
            {t('searching')}
          </CommandItem>
        )}
        {hits.map((item, index) => (
          <CommandItem
            key={item.id}
            value={`${DOCUMENT_PREFIX}${index}`}
            onSelect={() => {
              recent.visit(item.id);
              onClose();
              router.push(documentPath(projectKey, item.id));
            }}
          >
            <FileText />
            <span className="min-w-0 flex-1 truncate" dir="auto">
              {item.title || t('untitled')}
            </span>
            {item.isPrivate && <LockKeyhole className="size-3 text-muted-foreground" />}
          </CommandItem>
        ))}
      </CommandGroup>
    </>
  );
}
