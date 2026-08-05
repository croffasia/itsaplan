import {
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Music,
  Presentation,
  type LucideIcon,
} from 'lucide-react';

export function fileIcon(contentType: string): LucideIcon {
  if (contentType.startsWith('image/')) return FileImage;
  if (contentType.startsWith('video/')) return FileVideo;
  if (contentType.startsWith('audio/')) return Music;
  if (contentType.includes('spreadsheet') || contentType.includes('excel')) return FileSpreadsheet;
  if (contentType.includes('presentation') || contentType.includes('powerpoint'))
    return Presentation;
  if (
    contentType.startsWith('text/') ||
    contentType.includes('pdf') ||
    contentType.includes('word')
  ) {
    return FileText;
  }
  return File;
}
