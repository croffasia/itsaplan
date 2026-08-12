import { useTranslations } from 'next-intl';
import type { Column, GithubSettings } from '@/lib/api';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsSection from '@/components/common/page/SettingsSection';
import SettingsRow from '@/components/common/page/SettingsRow';
import GithubColumnSelect from './GithubColumnSelect';

// The pull request automations: which state a linked issue moves to when the PR
// merges into the default branch, and (optionally) when it is opened.
export default function GithubAutomationsCard({
  columns,
  settings,
  editable,
  onChange,
}: {
  columns: Column[];
  settings: GithubSettings;
  editable: boolean;
  onChange: (patch: { onMergeColumnId?: number | null; onOpenColumnId?: number | null }) => void;
}) {
  const t = useTranslations('settings.github');

  return (
    <SettingsSection title={t('automations')} description={t('automationsHint')}>
      <SettingsCard className="divide-y divide-border/60">
        <SettingsRow
          title={t('onMerge')}
          description={t('onMergeHint')}
          control={
            <GithubColumnSelect
              columns={columns}
              value={settings.onMergeColumnId}
              noneLabel={t('onMergeNone')}
              readOnly={!editable}
              onChange={(id) => onChange({ onMergeColumnId: id })}
            />
          }
        />
        <SettingsRow
          title={t('onOpen')}
          description={t('onOpenHint')}
          control={
            <GithubColumnSelect
              columns={columns}
              value={settings.onOpenColumnId}
              noneLabel={t('onOpenNone')}
              readOnly={!editable}
              onChange={(id) => onChange({ onOpenColumnId: id })}
            />
          }
        />
      </SettingsCard>
    </SettingsSection>
  );
}
