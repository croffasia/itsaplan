import { useEffect, useState } from 'react';
import type { Project } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { useUpdateEstimates } from '../services/settings.service';

// The estimate kinds of the project and whether its members log time, saved by the
// Configuration page header together with the rest of the page. The current state
// comes with the project payload the Shell already loaded, so there is nothing to
// fetch here.
export interface EstimatesForm {
  editable: boolean;
  saving: boolean;
  save: () => Promise<void>;
  points: boolean;
  setPoints: (v: boolean) => void;
  time: boolean;
  setTime: (v: boolean) => void;
  logging: boolean;
  setLogging: (v: boolean) => void;
}

export function useEstimatesForm(project: Project): EstimatesForm {
  const { can } = usePermissions();
  const update = useUpdateEstimates(project.key);

  const [points, setPoints] = useState(project.pointsEstimateEnabled);
  const [time, setTime] = useState(project.timeEstimateEnabled);
  const [logging, setLogging] = useState(project.timeLoggingEnabled);

  useEffect(() => {
    setPoints(project.pointsEstimateEnabled);
    setTime(project.timeEstimateEnabled);
    setLogging(project.timeLoggingEnabled);
  }, [project.pointsEstimateEnabled, project.timeEstimateEnabled, project.timeLoggingEnabled]);

  async function save() {
    await update.mutateAsync({ points, time, logging });
  }

  return {
    editable: can('workflow_config', 'edit'),
    saving: update.isPending,
    save,
    points,
    setPoints,
    time,
    setTime,
    logging,
    setLogging,
  };
}
