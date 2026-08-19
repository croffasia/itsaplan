import type { AgentTool } from '@/lib/api';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslations } from 'next-intl';

// One action in the Actions checklist. A read-only action is shown checked and
// disabled, with a tooltip saying why it cannot be turned off.
export function AgentActionRow({
  tool,
  checked,
  onToggle,
}: {
  tool: AgentTool;
  checked: boolean;
  onToggle: (on: boolean) => void;
}) {
  const t = useTranslations('settings.agents');

  const body = (
    <span>
      <span className="text-sm">{tool.label}</span>
      <span className="block text-xs text-muted-foreground">{tool.description}</span>
    </span>
  );

  if (tool.always) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-start gap-2 opacity-70">
            <Checkbox className="mt-0.5" checked disabled />
            {body}
          </div>
        </TooltipTrigger>
        <TooltipContent>{t('readOnlyAlwaysOn')}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <label className="flex cursor-pointer items-start gap-2">
      <Checkbox
        className="mt-0.5"
        checked={checked}
        onCheckedChange={(v) => onToggle(v === true)}
      />
      {body}
    </label>
  );
}
