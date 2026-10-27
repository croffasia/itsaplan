import { ExternalLink, Lock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PRO_URL } from '@/utils/app';

// The last of the source tabs where an edition has more sources: a link to that edition,
// not a tab, so moving through the tabs with the keyboard never opens it.
export default function SettingsImportExportMoreSources({
  label,
  hint,
}: {
  label: string;
  hint: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <a
          href={PRO_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 px-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <Lock className="size-3.5" />
          {label}
          <ExternalLink className="size-3.5" />
        </a>
      </TooltipTrigger>
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  );
}
