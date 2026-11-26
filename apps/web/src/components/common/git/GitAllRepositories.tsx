import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import {
  useGitReachableRepositoriesQuery,
  type GitRepositorySource,
} from '@/services/gitRepositories.service';
import GitRepositoryList from './GitRepositoryList';

// Every repository the token reaches, asked of the host.
export default function GitAllRepositories({ source }: { source: GitRepositorySource }) {
  const t = useTranslations('settings.git');
  const [search, setSearch] = useState('');
  const query = useGitReachableRepositoriesQuery(source, useDebouncedValue(search.trim(), 250));
  const team = 'teamId' in source;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="-ms-3 self-start text-muted-foreground">
          {t('allRepositories')}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-96 p-3">
        <p className="mb-2 text-xs text-muted-foreground">
          {t(team ? 'allRepositoriesTeamHint' : 'allRepositoriesAccountHint')}
        </p>
        <div className="max-h-80 overflow-y-auto">
          <GitRepositoryList
            query={query}
            search={search}
            onSearchChange={setSearch}
            empty={t(team ? 'nativeNoRepositories' : 'accountNoRepositories')}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
