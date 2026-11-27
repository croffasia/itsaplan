import { useState, type ReactNode } from 'react';
import type { IssuePropertyRowSpec } from '../../hooks/useIssuePropertyRows';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useTranslations } from 'next-intl';

// The fields left out of Properties because they are empty, offered one click away
// under their group's name. Picking one shows its row with the editor open.
export default function IssueAddFieldMenu({
  groups,
  onPick,
  children,
}: {
  groups: { heading: string; rows: IssuePropertyRowSpec[] }[];
  onPick: (key: string | number) => void;
  // The button that opens the menu, at the end of a section heading.
  children: ReactNode;
}) {
  const t = useTranslations('issue.customFields');
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      {/* Focus stays where the picked field's editor puts it: returned to this button,
          it would close the editor that has just opened. */}
      <PopoverContent className="w-64 p-0" align="end" onCloseAutoFocus={(e) => e.preventDefault()}>
        <Command>
          <CommandInput placeholder={t('findField')} />
          <CommandList>
            <CommandEmpty>{t('noFields')}</CommandEmpty>
            {groups.map((group) => (
              <CommandGroup key={group.heading} heading={group.heading}>
                {group.rows.map((row) => (
                  <CommandItem
                    key={row.key}
                    value={`${row.label} ${row.key}`}
                    className="[&_svg]:text-muted-foreground"
                    onSelect={() => {
                      setOpen(false);
                      onPick(row.key);
                    }}
                  >
                    {row.icon}
                    <span className="truncate" dir="auto">
                      {row.label}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
