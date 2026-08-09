import type { ProjectFile } from '@/lib/api';

export type FilePreviewType = 'image/png' | 'application/pdf';

export function filePreviewType(file: ProjectFile): FilePreviewType | null {
  const filename = file.filename.toLowerCase();
  if (file.contentType === 'image/png' || filename.endsWith('.png')) return 'image/png';
  if (file.contentType === 'application/pdf' || filename.endsWith('.pdf')) {
    return 'application/pdf';
  }
  return null;
}

export async function hasValidPreviewSignature(
  blob: Blob,
  type: FilePreviewType,
): Promise<boolean> {
  const bytes = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
  if (type === 'image/png') {
    const png = [137, 80, 78, 71, 13, 10, 26, 10];
    return png.every((value, index) => bytes[index] === value);
  }
  return (
    bytes[0] === 37 && bytes[1] === 80 && bytes[2] === 68 && bytes[3] === 70 && bytes[4] === 45
  );
}
