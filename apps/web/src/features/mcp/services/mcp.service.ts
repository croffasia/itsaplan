import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { qk } from '@/services/queryKeys';

// The current state lives on the project payload (getProject), so there is no read
// query here: this writes and invalidates the project.
export function useUpdateProjectMcp(projectKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) =>
      api.updateProjectSettings(projectKey, { mcpEnabled: enabled }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: qk.project(projectKey) });
      toast.success(
        data.mcpEnabled ? 'MCP enabled for this project' : 'MCP disabled for this project',
      );
    },
  });
}
