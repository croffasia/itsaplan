import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';

// The bottom of a picker in the agent editor: the ways to add what the team does not have yet.
export function AgentPickerFooter({ children }: { children: ReactNode }) {
  const t = useTranslations('teams.agents');
  return (
    <div className="m-1 mt-0 rounded-sm bg-muted/50 p-1">
      <p className="px-2 pt-1.5 pb-1 text-xs text-muted-foreground">{t('notInList')}</p>
      {children}
    </div>
  );
}
