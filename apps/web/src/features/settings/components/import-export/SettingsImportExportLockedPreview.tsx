import { Check } from 'lucide-react';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsSection from '@/components/common/page/SettingsSection';
import UpgradeToProButton from '@/components/common/UpgradeToProButton';
import type { ProFeature } from '@/utils/app';

// The tab of a source that an edition without its import shows: what that import brings.
export default function SettingsImportExportLockedPreview({
  title,
  description,
  items,
  feature,
}: {
  title: string;
  description: string;
  items: string[];
  feature: ProFeature;
}) {
  return (
    <SettingsSection title={title} description={description}>
      <SettingsCard className="space-y-6 p-6">
        <ul className="space-y-2 text-sm">
          {items.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
        <UpgradeToProButton feature={feature} />
      </SettingsCard>
    </SettingsSection>
  );
}
