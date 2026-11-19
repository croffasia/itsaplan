import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import UpgradeToProButton from '@/components/common/UpgradeToProButton';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import ToolLockedFormPreview from './ToolLockedFormPreview';

// The button for a tool of the team's own where no source makes one. The agent editor draws it
// inside its form, so it must not submit that form.
export default function ToolLockedCreateButton() {
  const t = useTranslations('teams.tools');
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" size="sm" variant="ghost" className="h-8 gap-1.5">
          <Plus className="size-3.5" />
          {t('ownTool')}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="overflow-hidden p-0 text-sm">
        <ToolLockedFormPreview />
        <div className="p-4">
          <p className="font-medium">{t('ownToolUnavailableTitle')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('ownToolUnavailableHint')}</p>
          <UpgradeToProButton feature="http-tools" className="mt-3" />
        </div>
      </PopoverContent>
    </Popover>
  );
}
