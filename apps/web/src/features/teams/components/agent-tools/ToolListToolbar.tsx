import { useTranslations } from 'next-intl';
import type { IntegrationMeta } from '@/lib/api/endpoints/integrations';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import SearchInput from '@/components/common/SearchInput';
import type { ToolSourceEntry } from '../../types/toolSource';

// The group picker's value for every tool.
export const ALL_GROUPS = 'all';

// The search and the group filter above the tool list, at either end. The groups are the
// team's own tools first, then each integration that has tools. Both refetch a page.
export default function ToolListToolbar({
  catalog,
  sources,
  group,
  onGroupChange,
  search,
  onSearchChange,
}: {
  catalog: IntegrationMeta[];
  sources: ToolSourceEntry[];
  group: string;
  onGroupChange: (group: string) => void;
  search: string;
  onSearchChange: (search: string) => void;
}) {
  const t = useTranslations('teams.tools');
  const integrations = catalog.filter((i) => i.tools.length > 0);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <SearchInput
        value={search}
        onChange={onSearchChange}
        placeholder={t('search')}
        className="w-60"
      />
      <Select value={group} onValueChange={onGroupChange}>
        <SelectTrigger className="ms-auto h-9 w-44" aria-label={t('group')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_GROUPS}>{t('allGroups')}</SelectItem>
          {sources.map((source) => (
            <SelectItem key={source.key} value={source.key}>
              {t('ownTools')}
            </SelectItem>
          ))}
          {sources.length > 0 && <SelectSeparator />}
          {integrations.map((integration) => (
            <SelectItem key={integration.key} value={integration.key}>
              {integration.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
