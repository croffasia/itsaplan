import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { saveTextFile } from '@/utils/download';
import { exportProjectTemplate, type ProjectTemplate } from '@/lib/api/endpoints/project-templates';

// Copies a template of the workspace to the clipboard, or saves it as a file, for another
// workspace to import. Plain reads, so they toast their own failure.
export function useTemplateExport(workspaceId: number) {
  const t = useTranslations('teams.templates');
  const tTransfer = useTranslations('settings.transfer');

  async function read(template: ProjectTemplate): Promise<string> {
    return JSON.stringify(await exportProjectTemplate(workspaceId, template.id), null, 2);
  }

  async function copy(template: ProjectTemplate) {
    try {
      await navigator.clipboard.writeText(await read(template));
      toast.success(t('copied', { name: template.name }));
    } catch {
      toast.error(tTransfer('copyFailed'));
    }
  }

  async function download(template: ProjectTemplate) {
    try {
      saveTextFile(`${template.name}.json`, await read(template));
    } catch {
      toast.error(t('downloadFailed'));
    }
  }

  return { copy, download };
}
