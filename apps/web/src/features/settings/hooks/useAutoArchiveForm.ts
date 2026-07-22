import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/usePermissions';
import { useAutoArchiveQuery, useUpdateAutoArchive } from '../services/settings.service';

// Default day counts prefilled when a state group's auto-archive is switched on.
const DEFAULT_COMPLETED_DAYS = 28;
const DEFAULT_CANCELED_DAYS = 7;

// The auto-archive thresholds form state, shared between the page header (the Save
// action) and the body (the threshold rows). Seeds from the stored settings and
// reseeds whenever they change (e.g. after a save).
export interface AutoArchiveForm {
  editable: boolean;
  saving: boolean;
  save: () => Promise<void>;
  completedOn: boolean;
  setCompletedOn: (v: boolean) => void;
  completedDays: string;
  setCompletedDays: (v: string) => void;
  canceledOn: boolean;
  setCanceledOn: (v: boolean) => void;
  canceledDays: string;
  setCanceledDays: (v: string) => void;
}

export function useAutoArchiveForm(projectKey: string): AutoArchiveForm {
  const { isOwner } = usePermissions();
  const settingsQuery = useAutoArchiveQuery(projectKey);
  const updateSettings = useUpdateAutoArchive(projectKey);

  const [completedOn, setCompletedOn] = useState(false);
  const [completedDays, setCompletedDays] = useState(String(DEFAULT_COMPLETED_DAYS));
  const [canceledOn, setCanceledOn] = useState(false);
  const [canceledDays, setCanceledDays] = useState(String(DEFAULT_CANCELED_DAYS));

  const data = settingsQuery.data;
  useEffect(() => {
    setCompletedOn(data?.completedDays != null);
    setCompletedDays(String(data?.completedDays ?? DEFAULT_COMPLETED_DAYS));
    setCanceledOn(data?.canceledDays != null);
    setCanceledDays(String(data?.canceledDays ?? DEFAULT_CANCELED_DAYS));
  }, [data]);

  async function save() {
    await updateSettings.mutateAsync({
      completedDays: completedOn
        ? Math.max(1, Number(completedDays) || DEFAULT_COMPLETED_DAYS)
        : null,
      canceledDays: canceledOn ? Math.max(1, Number(canceledDays) || DEFAULT_CANCELED_DAYS) : null,
    });
    toast.success('Auto-archive settings saved');
  }

  return {
    editable: isOwner,
    saving: updateSettings.isPending,
    save,
    completedOn,
    setCompletedOn,
    completedDays,
    setCompletedDays,
    canceledOn,
    setCanceledOn,
    canceledDays,
    setCanceledDays,
  };
}
