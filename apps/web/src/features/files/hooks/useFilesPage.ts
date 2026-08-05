import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { api, type ProjectFile, type StorageSettings } from '@/lib/api';
import { useFileDragZone } from '@/hooks/useFileDragZone';
import { attachmentError } from '@/utils/uploadLimits';
import { useDeleteFile, useFilesQuery, useUploadFile } from '@/services/files.service';

export function useFilesPage(projectKey: string, limits: StorageSettings | undefined) {
  const filesQuery = useFilesQuery(projectKey);
  const uploadFile = useUploadFile(projectKey);
  const deleteFile = useDeleteFile(projectKey);
  const [search, setSearch] = useState('');
  const [target, setTarget] = useState<ProjectFile | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const files = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query
      ? (filesQuery.data ?? []).filter((file) => file.filename.toLowerCase().includes(query))
      : (filesQuery.data ?? []);
  }, [filesQuery.data, search]);

  async function upload(filesToUpload: FileList) {
    let uploaded = 0;
    for (const file of Array.from(filesToUpload)) {
      const reason = attachmentError(file, limits);
      if (reason) {
        toast.error(reason);
        continue;
      }
      try {
        await uploadFile.mutateAsync({ file });
        uploaded += 1;
      } catch {
        // Mutation errors are shown by the global React Query handler.
      }
    }
    if (uploaded > 0) {
      toast.success(uploaded === 1 ? 'File uploaded' : `${uploaded} files uploaded`);
    }
  }

  async function download(file: ProjectFile) {
    setDownloadingId(file.id);
    try {
      const blob = await api.downloadProjectFile(file.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = file.filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Download failed');
    } finally {
      setDownloadingId(null);
    }
  }

  const dragZone = useFileDragZone((selected) => void upload(selected));

  async function deleteTarget() {
    if (!target) return;
    await deleteFile.mutateAsync(target.id);
    setTarget(null);
  }

  return {
    deleteTarget,
    downloadingId,
    dragZone,
    files,
    filesQuery,
    search,
    setSearch,
    setTarget,
    target,
    upload: (selected: FileList) => void upload(selected),
    uploadFile,
    download: (file: ProjectFile) => void download(file),
  };
}
