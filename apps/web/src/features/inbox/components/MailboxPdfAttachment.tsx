'use client';

import { ExternalLink, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

export default function MailboxPdfAttachment({
  projectKey,
  folder,
  uid,
  index,
  filename,
}: {
  projectKey: string;
  folder: string;
  uid: number;
  index: number;
  filename: string;
}) {
  const open = async () => {
    const preview = window.open('', '_blank');
    try {
      const blob = await api.openMailboxPdf(projectKey, uid, index, folder);
      // Not revoked on a timer: the opened tab keeps pointing at this URL and
      // has to survive a reload. The browser frees it when the inbox unloads.
      const url = URL.createObjectURL(blob);
      if (preview) preview.location.href = url;
      else window.open(url, '_blank');
    } catch (error) {
      preview?.close();
      toast.error(error instanceof Error ? error.message : 'Could not open PDF');
    }
  };

  return (
    <button
      type="button"
      onClick={() => void open()}
      className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs transition-colors hover:bg-muted"
    >
      <FileText className="size-3.5 text-muted-foreground" />
      <span>{filename}</span>
      <ExternalLink className="size-3 text-muted-foreground" />
    </button>
  );
}
