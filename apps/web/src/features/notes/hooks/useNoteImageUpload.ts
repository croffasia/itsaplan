import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useReactFlow } from '@xyflow/react';
import type { StorageSettings } from '@/lib/api';
import { attachmentError } from '@/utils/uploadLimits';
import { useUploadNoteBoardImage } from '../services/noteBoards.service';
import { newImageNode, type NoteFlowNode } from '../utils/noteCanvas';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

async function imageAspectRatio(file: File): Promise<number> {
  try {
    const bitmap = await createImageBitmap(file);
    const ratio = bitmap.width / bitmap.height;
    bitmap.close();
    return Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
  } catch {
    throw new Error(`"${file.name}" is not a valid image`);
  }
}

export function useNoteImageUpload(
  projectKey: string,
  boardId: number,
  limits: StorageSettings | undefined,
) {
  const [uploading, setUploading] = useState(false);
  const uploadImage = useUploadNoteBoardImage(projectKey, boardId);
  const { setNodes, screenToFlowPosition } = useReactFlow<NoteFlowNode>();

  const upload = useCallback(
    async (files: FileList) => {
      setUploading(true);
      let added = 0;
      try {
        const bounds = document.querySelector('.react-flow')?.getBoundingClientRect();
        const center = screenToFlowPosition({
          x: (bounds?.left ?? 0) + (bounds?.width ?? 0) / 2,
          y: (bounds?.top ?? 0) + (bounds?.height ?? 0) / 2,
        });

        for (const [index, file] of Array.from(files).entries()) {
          const limitError = attachmentError(file, limits);
          if (limitError) {
            toast.error(limitError);
            continue;
          }
          if (!IMAGE_TYPES.has(file.type.toLowerCase())) {
            toast.error(`"${file.name}" must be a JPEG, PNG, WebP, or GIF photo`);
            continue;
          }

          try {
            const ratio = await imageAspectRatio(file);
            const image = await uploadImage.mutateAsync(file);
            const position = { x: center.x + index * 24, y: center.y + index * 24 };
            setNodes((nodes) => [...nodes, newImageNode(position, image, ratio)]);
            added += 1;
          } catch (error) {
            toast.error(error instanceof Error ? error.message : `Could not upload ${file.name}`);
          }
        }
        if (added > 0) toast.success(added === 1 ? 'Photo added' : `${added} photos added`);
      } finally {
        setUploading(false);
      }
    },
    [limits, screenToFlowPosition, setNodes, uploadImage],
  );

  return { uploading, upload };
}
