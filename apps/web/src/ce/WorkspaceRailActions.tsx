import { ExternalLink, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { workspaceTileClass } from '@/components/layout/utils/workspaceTile';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PRO_URL } from '@/utils/app';

// Below the workspace tiles of a rail. On a self-hosted instance a person owns one
// workspace, made at sign-up, so the button says where more are available; the hosted
// build creates a workspace instead.
export default function WorkspaceRailActions() {
  const t = useTranslations('teams.workspace');
  const tCommon = useTranslations('common');

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button type="button" aria-label={t('create')} className={workspaceTileClass(false)}>
              <Plus className="size-4" />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="right">{t('create')}</TooltipContent>
      </Tooltip>
      <PopoverContent side="right" align="start" className="w-64 text-sm">
        <p className="font-medium">{t('createUnavailableTitle')}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t('createUnavailableHint')}</p>
        <a
          href={PRO_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium hover:underline"
        >
          {tCommon('aboutCloudAndPro')}
          <ExternalLink className="size-3.5" />
        </a>
      </PopoverContent>
    </Popover>
  );
}
