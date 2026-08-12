'use client';

import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { ProjectDetail, ProjectFeatures } from '@/lib/api';
import { projectFeatures } from '@/utils/projectFeatures';
import { useFeatureLabel } from '@/hooks/useFeatureLabel';
import { usePermissions } from '@/hooks/usePermissions';
import { useUpdateProjectFeatures } from '../services/settings.service';

export interface FeatureTogglesForm {
  features: ProjectFeatures;
  // Only an owner may toggle; others see the current state read-only.
  editable: boolean;
  saving: boolean;
  toggle: (feature: keyof ProjectFeatures, enabled: boolean) => Promise<void>;
}

// The optional sections of the project, read from the project payload the Shell
// already loaded. Each switch saves on its own — there is nothing to draft, so the
// General page's Save button does not cover it.
export function useFeatureToggles(project: ProjectDetail): FeatureTogglesForm {
  const t = useTranslations('settings.general');
  const featureLabel = useFeatureLabel();
  const { isOwner } = usePermissions();
  const update = useUpdateProjectFeatures(project.project.key);

  async function toggle(feature: keyof ProjectFeatures, enabled: boolean) {
    await update.mutateAsync({ [feature]: enabled });
    toast.success(t(enabled ? 'featureOn' : 'featureOff', { feature: featureLabel(feature) }));
  }

  return {
    features: projectFeatures(project.project),
    editable: isOwner,
    saving: update.isPending,
    toggle,
  };
}
