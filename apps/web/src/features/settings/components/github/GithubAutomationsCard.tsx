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
  return (
    <SettingsSection
      title="Pull request automations"
      description={
        'Write a magic word and an issue ID in a pull request title or description, like ' +
        '“Closes KEY-123”. Close, fix, resolve, complete, and implement close the issue when ' +
        'the PR merges. Ref, part of, and related to link it without closing. Write ' +
        '“skip KEY-123” to leave an issue out.'
      }
    >
      <SettingsCard className="divide-y divide-border/60">
        <SettingsRow
          title="When a linked PR is merged"
          description="The issue moves to this state when the PR merges into the default branch."
          control={
            <GithubColumnSelect
              columns={columns}
              value={settings.onMergeColumnId}
              noneLabel="First completed state"
              readOnly={!editable}
              onChange={(id) => onChange({ onMergeColumnId: id })}
            />
          }
        />
        <SettingsRow
          title="When a linked PR is opened"
          description="Only moves issues that haven't been started. Issues in progress or closed stay where they are."
          control={
            <GithubColumnSelect
              columns={columns}
              value={settings.onOpenColumnId}
              noneLabel="No action"
              readOnly={!editable}
              onChange={(id) => onChange({ onOpenColumnId: id })}
            />
          }
        />
      </SettingsCard>
    </SettingsSection>
  );
}
