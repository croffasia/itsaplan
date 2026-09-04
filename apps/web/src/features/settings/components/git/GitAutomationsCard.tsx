import { useTranslations } from 'next-intl';
import type { Column, GitSettings } from '@/lib/api';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsSection from '@/components/common/page/SettingsSection';
import SettingsRow from '@/components/common/page/SettingsRow';
import { Switch } from '@/components/ui/switch';
import GitColumnSelect from './GitColumnSelect';

// The pull request automations: which state a linked issue moves to when the pull
// request merges into the default branch, and (optionally) when it is opened.
export default function GitAutomationsCard({
  columns,
  settings,
  editable,
  onChange,
}: {
  columns: Column[];
  settings: GitSettings;
  editable: boolean;
  onChange: (patch: {
    onMergeColumnId?: number | null;
    onOpenColumnId?: number | null;
    linkbackComments?: boolean;
  }) => void;
}) {
  const t = useTranslations('settings.git');

  return (
    <SettingsSection title={t('automations')} description={t('automationsHint')}>
      <SettingsCard className="divide-y divide-border/60">
        <SettingsRow
          title={t('linkbackComments')}
          description={t('linkbackCommentsHint')}
          control={
            <Switch
              checked={settings.linkbackComments}
              disabled={!editable}
              onCheckedChange={(linkbackComments) => onChange({ linkbackComments })}
            />
          }
        />
        <SettingsRow
          title={t('onMerge')}
          description={t('onMergeHint')}
          control={
            <GitColumnSelect
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
            <GitColumnSelect
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
