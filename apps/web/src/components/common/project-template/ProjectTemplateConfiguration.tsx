'use client';

import { useTranslations } from 'next-intl';
import type { EstimateSettings, ProjectFeatures } from '@/lib/api/endpoints/settings';
import { useFeatureLabel } from '@/hooks/useFeatureLabel';
import OnOffStatus from '@/components/common/fields/OnOffStatus';
import ProjectTemplateRow from './ProjectTemplateRow';

// The project sections and the estimates a template turns on, beside the ones it
// leaves off.
export default function ProjectTemplateConfiguration({
  features,
  estimates,
}: {
  features: ProjectFeatures;
  estimates: EstimateSettings;
}) {
  const tGeneral = useTranslations('settings.general');
  const tConfig = useTranslations('settings.configuration');
  const featureLabel = useFeatureLabel();

  const sections = (Object.keys(features) as (keyof ProjectFeatures)[]).map((feature) => ({
    key: feature,
    on: features[feature],
    name: featureLabel(feature),
  }));
  const kinds = [
    { key: 'points', on: estimates.points, name: tConfig('pointsEstimate') },
    { key: 'time', on: estimates.time, name: tConfig('timeEstimate') },
    { key: 'logging', on: estimates.logging, name: tConfig('timeLogging') },
  ];

  return (
    <>
      {[
        { label: tGeneral('features'), items: sections },
        { label: tConfig('estimates'), items: kinds },
      ].map((row) => (
        <ProjectTemplateRow key={row.label} label={row.label}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {row.items.map((item) => (
              <OnOffStatus key={item.key} on={item.on}>
                {item.name}
              </OnOffStatus>
            ))}
          </div>
        </ProjectTemplateRow>
      ))}
    </>
  );
}
