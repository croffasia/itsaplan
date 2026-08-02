import { useEffect, useRef, useState } from 'react';
import { useStorageSettingsQuery } from '@/services/storage.service';
import { attachmentError } from '@/utils/uploadLimits';
import { useUploadAttachment } from '../services/attachments.service';
import { type Embeddable } from '../utils/attachmentEmbed';

export type PendingAttachment = Embeddable & { id: number; file: File };

// Files attached to an issue that does not exist yet. An upload needs an issue
// id, so every file waits here until the issue is created and is uploaded then.
// Until that happens a file is served from a local blob: URL, which is what the
// list previews and what an embed in the description points at; uploadAll
// returns the stored URL to rewrite each embed to.
export function useNewIssueAttachments() {
  const limits = useStorageSettingsQuery().data;
  const uploadAttachment = useUploadAttachment();
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const nextId = useRef(0);
  const blobUrls = useRef<string[]>([]);
  const removedUrls = useRef<string[]>([]);

  useEffect(() => {
    const urls = blobUrls.current;
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, []);

  // Null when the file is refused; the reason is then in `error`.
  function add(file: File): PendingAttachment | null {
    // The api enforces the same limits; checking here avoids holding a file
    // that is going to be refused on submit.
    const reason = attachmentError(file, limits);
    if (reason) {
      setError(reason);
      return null;
    }
    setError(null);
    const url = URL.createObjectURL(file);
    blobUrls.current.push(url);
    const item = { id: nextId.current++, file, url, contentType: file.type, filename: file.name };
    setPending((prev) => [...prev, item]);
    return item;
  }

  function attach(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) add(file);
  }

  // Handed to the markdown editors as their uploadFile: the file is attached and
  // the editor embeds the returned blob: URL at the cursor.
  async function uploadFile(file: File): Promise<Embeddable> {
    const item = add(file);
    if (!item) throw new Error('File refused');
    return item;
  }

  // Swaps a pending file for another one, keeping its place in the list. The new
  // file gets its own blob: URL, so the caller has to point the embeds of the old
  // one at it; the old URL is also queued for stripping in case one is missed.
  // Returns the old and the new URL, or null when the file is refused.
  function replace(id: number, file: File): { from: string; to: string } | null {
    const previous = pending.find((p) => p.id === id);
    if (!previous) return null;
    const reason = attachmentError(file, limits);
    if (reason) {
      setError(reason);
      return null;
    }
    setError(null);
    const url = URL.createObjectURL(file);
    blobUrls.current.push(url);
    removedUrls.current.push(previous.url);
    setPending((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, file, url, contentType: file.type, filename: file.name } : p,
      ),
    );
    return { from: previous.url, to: url };
  }

  // Returns the removed attachment, so the caller can drop its embeds too.
  function remove(id: number): PendingAttachment | null {
    const item = pending.find((p) => p.id === id);
    if (!item) return null;
    removedUrls.current.push(item.url);
    setPending((prev) => prev.filter((p) => p.id !== id));
    return item;
  }

  // Uploads every pending file to the freshly created issue and returns each
  // blob: URL mapped to its stored URL. A removed file, and one whose upload
  // failed, maps to an empty string: its embed is stripped instead of rewritten.
  async function uploadAll(issueId: number): Promise<Map<string, string>> {
    const urls = new Map<string, string>(removedUrls.current.map((url) => [url, '']));
    for (const item of pending) {
      const uploaded = await uploadAttachment
        .mutateAsync({ issueId, file: item.file })
        .catch(() => null);
      urls.set(item.url, uploaded ? uploaded.url : '');
    }
    return urls;
  }

  return { pending, error, attach, uploadFile, replace, remove, uploadAll };
}
