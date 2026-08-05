import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Download, FolderOpen, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { api, type ProjectFile } from '@/lib/api';
import { filesPath } from '@/utils/paths';
import { fileIcon } from '@/utils/fileIcon';
import { formatFileSize } from '@/utils/fileSize';
import { attachmentError } from '@/utils/uploadLimits';
import { useFilesQuery, useUploadFile } from '@/services/files.service';
import { useStorageSettingsQuery } from '@/services/storage.service';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function CrmFilesCard({
  projectKey,
  customerId,
  canUpload,
}: {
  projectKey: string;
  customerId: string;
  canUpload: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const filesQuery = useFilesQuery(projectKey);
  const uploadFile = useUploadFile(projectKey);
  const limits = useStorageSettingsQuery().data;
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const files = useMemo(
    () => (filesQuery.data ?? []).filter((file) => file.customerId === customerId),
    [customerId, filesQuery.data],
  );

  const upload = async (selected: FileList) => {
    let uploaded = 0;
    for (const file of Array.from(selected)) {
      const reason = attachmentError(file, limits);
      if (reason) {
        toast.error(reason);
        continue;
      }
      try {
        await uploadFile.mutateAsync({ file, customerId });
        uploaded += 1;
      } catch {
        // Mutation errors are shown by the global React Query handler.
      }
    }
    if (uploaded > 0) {
      toast.success(uploaded === 1 ? 'Customer file uploaded' : `${uploaded} files uploaded`);
    }
  };

  const download = async (file: ProjectFile) => {
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
  };

  return (
    <Card className="gap-4 py-5 shadow-none lg:col-span-2">
      <CardHeader className="px-5">
        <CardTitle className="flex items-center gap-2 text-sm">
          <FolderOpen className="size-4 text-muted-foreground" />
          Files
        </CardTitle>
        {canUpload && (
          <CardAction>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploadFile.isPending}
              onClick={() => inputRef.current?.click()}
            >
              {uploadFile.isPending ? <Loader2 className="animate-spin" /> : <Upload />}
              Upload
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="px-5">
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => {
            if (event.target.files) void upload(event.target.files);
            event.target.value = '';
          }}
        />
        {filesQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading files…</p>
        ) : files.length === 0 ? (
          <p className="text-sm text-muted-foreground">No files linked to this customer.</p>
        ) : (
          <div className="divide-y rounded-md border">
            {files.map((file) => {
              const Icon = fileIcon(file.contentType);
              return (
                <div key={file.id} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{file.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.sizeBytes)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={downloadingId === file.id}
                    aria-label={`Download ${file.filename}`}
                    title="Download"
                    onClick={() => void download(file)}
                  >
                    {downloadingId === file.id ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Download />
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
        <Button asChild variant="link" size="sm" className="mt-2 h-auto px-0">
          <Link href={filesPath(projectKey)}>View all project files</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
