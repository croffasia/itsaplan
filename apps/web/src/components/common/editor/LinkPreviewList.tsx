import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { LinkPreviewItem } from './LinkPreviewDialog';
import { linkPreviewDestination } from './linkPreviewDestination';
import styles from './LinkPreviewDialog.module.css';

export default function LinkPreviewList({
  links,
  focusIndex,
  onSelect,
}: {
  links: LinkPreviewItem[];
  focusIndex: number;
  onSelect: (index: number) => void;
}) {
  const origin = typeof window === 'undefined' ? undefined : window.location.origin;
  return (
    <ul className="space-y-1">
      {links.map((link, index) => (
        <li key={`${index}:${link.url}`}>
          <Button
            type="button"
            variant="ghost"
            className={`${styles.control} w-full justify-start gap-4 p-3 text-start`}
            data-link-preview-primary={index === focusIndex ? '' : undefined}
            onClick={() => onSelect(index)}
          >
            <span className="min-w-0 flex-1 space-y-1">
              <span className="block wrap-anywhere" dir="auto">
                {link.label || link.url}
              </span>
              <span className="block text-sm font-normal text-muted-foreground" dir="ltr">
                {linkPreviewDestination(link.url, origin)?.hostname}
              </span>
            </span>
            <ChevronRight className="size-4 rtl:rotate-180" aria-hidden="true" />
          </Button>
        </li>
      ))}
    </ul>
  );
}
