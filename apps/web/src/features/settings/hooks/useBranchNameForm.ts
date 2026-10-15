import { useEffect, useState } from 'react';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import { usePermissions } from '@/hooks/usePermissions';
import { useUpdateBranchName } from '../services/settings.service';

// The branch name template, saved by the Configuration page header together with the
// rest of the page. The current template comes with the project payload the Shell
// already loaded, so there is nothing to fetch here.
export interface BranchNameForm {
  editable: boolean;
  saving: boolean;
  save: () => Promise<void>;
  template: string;
  setTemplate: (v: string) => void;
}

export function useBranchNameForm(project: ProjectDetail): BranchNameForm {
  const { can } = usePermissions();
  const update = useUpdateBranchName(project.project.ref);
  const [template, setTemplate] = useState(project.branchNameTemplate);

  useEffect(() => {
    setTemplate(project.branchNameTemplate);
  }, [project.branchNameTemplate]);

  async function save() {
    if (template.trim() === project.branchNameTemplate) return;
    await update.mutateAsync(template);
  }

  return {
    editable: can('workflow_config', 'edit'),
    saving: update.isPending,
    save,
    template,
    setTemplate,
  };
}
