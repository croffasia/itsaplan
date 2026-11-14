import { CircleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { AgentEmptyNotice } from './AgentEmptyNotice';

// What a section of the agent editor shows when the team's library it lists does not load.
export function AgentLoadFailed({ title, onRetry }: { title: string; onRetry: () => void }) {
  const t = useTranslations('teams.agents');
  return (
    <AgentEmptyNotice icon={CircleAlert} title={title} hint={t('loadFailedHint')}>
      <Button type="button" size="sm" variant="outline" onClick={onRetry}>
        {t('tryAgain')}
      </Button>
    </AgentEmptyNotice>
  );
}
