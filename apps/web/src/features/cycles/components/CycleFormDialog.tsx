'use client';

import { useTranslations } from 'next-intl';
import type { Cycle } from '@/lib/api';
import Modal from '@/components/common/overlay/Modal';
import { useCyclesQuery } from '@/services/cycles.service';
import { cycleDefaults } from '../utils/cycleDefaults';
import CycleForm from './CycleForm';

// Creating a cycle or editing one. Both need every cycle of the project: a new one
// is filled in from the last of them, and neither may take dates another one holds.
// The list is its own request — the cycles page loads the planned ones and pages the
// rest — so the dialog opens on a placeholder and mounts the form once it is in.
export default function CycleFormDialog({
  projectKey,
  cycle,
  onClose,
}: {
  projectKey: string;
  cycle?: Cycle;
  onClose: () => void;
}) {
  const t = useTranslations('cycles');
  const tCommon = useTranslations('common');
  const { data: cycles } = useCyclesQuery(projectKey);

  if (!cycles) {
    return (
      <Modal
        title={cycle ? t('form.editTitle') : t('form.newTitle')}
        projectKey={projectKey}
        onClose={onClose}
      >
        <p className="text-sm text-muted-foreground">{tCommon('loading')}</p>
      </Modal>
    );
  }

  return (
    <CycleForm
      projectKey={projectKey}
      cycle={cycle}
      cycles={cycles}
      defaults={cycleDefaults(cycles, (n) => t('defaultName', { n }))}
      onClose={onClose}
    />
  );
}
