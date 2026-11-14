import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import UpgradeToProButton from '@/components/common/UpgradeToProButton';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// The button for a tool of the team's own where no source makes one: it says what such tools do
// and where they are available.
export default function ToolLockedCreateButton() {
  const t = useTranslations('teams.tools');
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost" className="h-8 gap-1.5">
          <Plus className="size-3.5" />
          {t('ownTool')}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 text-sm">
        <p className="font-medium">{t('ownToolUnavailableTitle')}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t('ownToolUnavailableHint')}</p>
        <UpgradeToProButton className="mt-3" />
      </PopoverContent>
    </Popover>
  );
}
