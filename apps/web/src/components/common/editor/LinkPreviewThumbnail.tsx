import { useState } from 'react';
import { CircleDot, FileText, FolderKanban, Globe, LayoutList, StickyNote } from 'lucide-react';
import type { ResolvedLinkPreview } from './resolveLinkPreview';
import styles from './LinkPresentation.module.css';

const icons = {
  project: FolderKanban,
  issue: CircleDot,
  document: FileText,
  notes: StickyNote,
  view: LayoutList,
};

export default function LinkPreviewThumbnail({
  image,
  kind,
}: {
  image?: string | null;
  kind?: ResolvedLinkPreview['kind'];
}) {
  const [failed, setFailed] = useState<string>();
  const Icon = kind ? icons[kind] : Globe;
  return (
    <span className={styles.thumbnail} aria-hidden="true">
      {image && failed !== image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" referrerPolicy="no-referrer" onError={() => setFailed(image)} />
      ) : (
        <Icon size={16} />
      )}
    </span>
  );
}
