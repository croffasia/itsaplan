import { useEffect, useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import {
  useSubtaskAutomationQuery,
  useUpdateSubtaskAutomation,
} from '../services/settings.service';

// The subtask automation form state, saved by the Configuration page header
// together with the auto-archive thresholds. Seeds from the stored settings and
// reseeds whenever they change (e.g. after a save).
export interface SubtaskAutomationForm {
  editable: boolean;
  loaded: boolean;
  saving: boolean;
  save: () => Promise<void>;
  completeParent: boolean;
  setCompleteParent: (v: boolean) => void;
  closeSubtasks: boolean;
  setCloseSubtasks: (v: boolean) => void;
}

export function useSubtaskAutomationForm(projectKey: string): SubtaskAutomationForm {
  const { can } = usePermissions();
  const settingsQuery = useSubtaskAutomationQuery(projectKey);
  const updateSettings = useUpdateSubtaskAutomation(projectKey);

  const [completeParent, setCompleteParent] = useState(false);
  const [closeSubtasks, setCloseSubtasks] = useState(false);

  const data = settingsQuery.data;
  useEffect(() => {
    setCompleteParent(data?.completeParent ?? false);
    setCloseSubtasks(data?.closeSubtasks ?? false);
  }, [data]);

  async function save() {
    await updateSettings.mutateAsync({ completeParent, closeSubtasks });
  }

  return {
    editable: can('workflow_config', 'edit'),
    loaded: settingsQuery.isSuccess,
    saving: updateSettings.isPending,
    save,
    completeParent,
    setCompleteParent,
    closeSubtasks,
    setCloseSubtasks,
  };
}
