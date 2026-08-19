import { useState } from 'react';
import { Check } from 'lucide-react';
import type { IntegrationOption } from '@/lib/api';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent } from '@/components/ui/popover';
import { useTranslations } from 'next-intl';
import { AgentComboboxTrigger } from './AgentComboboxTrigger';

// Provider-key picker for an agent: the project's AI provider credentials, in the
// same control as the model picker next to it.
export default function AgentCredentialField({
  value,
  onChange,
  credentials,
  label,
}: {
  value: number | null;
  onChange: (credentialId: number) => void;
  credentials: IntegrationOption[];
  // How one credential is written out (integration name plus its own label).
  label: (credential: IntegrationOption) => string;
}) {
  const t = useTranslations('settings.agents');
  const [open, setOpen] = useState(false);
  const selected = credentials.find((c) => c.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <AgentComboboxTrigger
        value={selected ? label(selected) : ''}
        placeholder={t('chooseCredential')}
        open={open}
      />
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        {/* The input is what takes focus in the open popover, so it is also what makes
            the list navigable by keyboard. */}
        <Command>
          <CommandInput placeholder={t('searchCredential')} />
          <CommandList
            className="max-h-[16rem]"
            // The field lives inside a Radix Sheet whose scroll lock blocks wheel
            // events on this portaled list, so scroll it manually on wheel.
            onWheel={(e) => {
              e.currentTarget.scrollTop += e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
            }}
          >
            <CommandEmpty>{t('noCredentialsFound')}</CommandEmpty>
            <CommandGroup>
              {credentials.map((credential) => (
                <CommandItem
                  key={credential.id}
                  value={label(credential)}
                  onSelect={() => {
                    onChange(credential.id);
                    setOpen(false);
                  }}
                >
                  <span className="flex-1 truncate">{label(credential)}</span>
                  {credential.id === value && <Check className="ms-auto size-4" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
