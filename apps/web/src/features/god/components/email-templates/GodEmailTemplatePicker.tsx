'use client';

import { ChevronDown } from 'lucide-react';
import { LOCALES } from '@/i18n/locales';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import GodEmailEditedDot from './GodEmailEditedDot';
import { useGodEmailTemplateText } from '../../hooks/useGodEmailTemplateText';
import type { EmailSelection, GodEmailTemplatesForm } from '../../hooks/useGodEmailTemplatesForm';

export default function GodEmailTemplatePicker({
  form,
  selection,
  onSelect,
}: {
  form: GodEmailTemplatesForm;
  selection: EmailSelection;
  onSelect: (patch: Partial<EmailSelection>) => void;
}) {
  const text = useGodEmailTemplateText();
  const { templates } = form.settings;
  const groups = [...new Set(templates.map((entry) => entry.group))];
  const current = form.template(selection.key);
  const hint = text.hint(current.key);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="max-w-full min-w-80 justify-start gap-2">
            <span className="font-normal text-muted-foreground">{text.group(current.group)}</span>
            <span className="font-normal text-muted-foreground">/</span>
            <span className="truncate">{text.name(current.key)}</span>
            <ChevronDown className="ms-auto size-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-[460px] w-90">
          {groups.map((group) => (
            <DropdownMenuGroup key={group}>
              <DropdownMenuLabel>{text.group(group)}</DropdownMenuLabel>
              {templates
                .filter((entry) => entry.group === group)
                .map((entry) => (
                  <DropdownMenuItem key={entry.key} onSelect={() => onSelect({ key: entry.key })}>
                    <span className="min-w-0 flex-1">{text.name(entry.key)}</span>
                    {LOCALES.some((locale) => form.isEdited(entry.key, locale)) && (
                      <GodEmailEditedDot />
                    )}
                  </DropdownMenuItem>
                ))}
            </DropdownMenuGroup>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {hint && <span className="text-[13px] text-muted-foreground">{hint}</span>}
    </div>
  );
}
