import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type ProFeature, proUrl } from '@/utils/app';

// The mark on something another edition made, which does not work here: a link to the page about
// that edition. It stops the click, so a row it sits in does not open.
export default function NeedsProLink({
  feature,
  label,
  hint,
  className,
}: {
  feature: ProFeature;
  label: string;
  hint: string;
  className?: string;
}) {
  return (
    <a
      href={proUrl(feature)}
      target="_blank"
      rel="noreferrer"
      title={hint}
      className={cn(
        'inline-flex w-fit items-center gap-1 text-xs font-medium text-warning hover:underline',
        className,
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <Lock className="size-3.5" />
      {label}
    </a>
  );
}
