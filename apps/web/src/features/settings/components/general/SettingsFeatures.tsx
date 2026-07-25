import type { ProjectFeatures } from '@/lib/api';
import { FEATURE_LABEL } from '@/utils/projectFeatures';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsSection from '@/components/common/page/SettingsSection';
import SettingsRow from '@/components/common/page/SettingsRow';
import { Switch } from '@/components/ui/switch';
import type { FeatureTogglesForm } from '../../hooks/useFeatureToggles';

// What each optional section holds, in the order the sidebar lists them.
const FEATURES: { key: keyof ProjectFeatures; description: string }[] = [
  { key: 'dashboards', description: 'Charts and metrics on saved dashboards.' },
  { key: 'initiatives', description: 'Groups of issues tracked as one piece of work.' },
  { key: 'notes', description: 'Freeform boards of sticky notes.' },
];

// The Features block of the General page. Each switch saves on its own. Only an
// owner may change them; others see the current state read-only.
export default function SettingsFeatures({ form }: { form: FeatureTogglesForm }) {
  return (
    <SettingsSection
      title="Features"
      description="Sections this project shows. Turning one off hides it and keeps its content."
    >
      <SettingsCard className="divide-y divide-border/60">
        {FEATURES.map((feature) => (
          <SettingsRow
            key={feature.key}
            title={FEATURE_LABEL[feature.key]}
            description={feature.description}
            control={
              <Switch
                checked={form.features[feature.key]}
                disabled={!form.editable || form.saving}
                onCheckedChange={(enabled) => void form.toggle(feature.key, enabled)}
              />
            }
          />
        ))}
      </SettingsCard>
    </SettingsSection>
  );
}
