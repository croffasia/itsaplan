import { useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { MatrixCheckbox } from '@/components/common/permissions/MatrixCheckbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

export default function AccountNotificationTeam({
  name,
  count,
  picked,
  onPick,
  children,
}: {
  name: string;
  count: number;
  // How many of its projects are selected, null while projects are not being selected.
  picked: number | null;
  onPick: (on: boolean) => void;
  children: ReactNode;
}) {
  const t = useTranslations('account.notifications');
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="flex items-center gap-3 border-b border-border/60">
        {picked !== null && (
          <MatrixCheckbox
            checked={picked === count || (picked > 0 && 'indeterminate')}
            onCheckedChange={() => onPick(picked < count)}
            aria-label={t('selectTeam', { team: name })}
          />
        )}
        <h3 className="min-w-0 flex-1">
          <CollapsibleTrigger className="group/team flex min-h-11 w-full items-center gap-3 rounded-sm text-start outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
            <span className="min-w-0 flex-1 text-sm font-medium wrap-anywhere" dir="auto">
              {name}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {t('projectCount', { count })}
            </span>
            <ChevronRight
              className={cn(
                'size-4 shrink-0 text-muted-foreground transition group-hover/team:text-foreground',
                open ? 'rotate-90' : 'rtl:rotate-180',
              )}
            />
          </CollapsibleTrigger>
        </h3>
      </div>
      <CollapsibleContent className="ps-3 pt-1 pb-4">{children}</CollapsibleContent>
    </Collapsible>
  );
}
