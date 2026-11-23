import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { NewProjectDocumentInput } from '@/lib/api/endpoints/documents';
import { documentPath } from '@/utils/paths';
import { useCreateDocument } from '../services/documents.service';
import { importedMarkdownJson, markdownTitle } from '../utils/documentImport';
import { useDocumentsSearch } from './useDocumentsSearch';

// Creates a page, blank or from a Markdown file, and opens it.
export function useDocumentCreate(projectKey: string) {
  const t = useTranslations('documents');
  const router = useRouter();
  const createDocument = useCreateDocument(projectKey);
  const [, setSearch] = useDocumentsSearch(projectKey);

  const create = async (input: NewProjectDocumentInput) => {
    try {
      const created = await createDocument.mutateAsync(input);
      setSearch('');
      router.push(documentPath(projectKey, created.id));
    } catch {
      // Mutation errors are reported by the shared query client.
    }
  };

  const upload = async (file: File) => {
    let markdown: string;
    try {
      markdown = (await file.text()).replace(/^\uFEFF/, '');
    } catch {
      toast.error(t('markdownReadFailed'));
      return;
    }
    const contentJson = importedMarkdownJson(markdown);
    if (!contentJson) {
      toast.error(t('markdownTooLarge'));
      return;
    }
    await create({ title: markdownTitle(file.name), content: markdown, contentJson });
  };

  return { create, upload, creating: createDocument.isPending };
}
