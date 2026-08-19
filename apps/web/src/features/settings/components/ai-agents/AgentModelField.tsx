import { useState } from 'react';
import { Check } from 'lucide-react';
import type { ProviderModel } from '@/lib/api';
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

// Model picker for an agent: a searchable list of the selected provider's models
// (from the models.dev registry) that also accepts a model id typed by hand, so a
// custom or unlisted model still works. Disabled until a provider is chosen.
export default function AgentModelField({
  value,
  onChange,
  models,
  loading,
  disabled,
}: {
  value: string;
  onChange: (model: string) => void;
  models: ProviderModel[];
  loading: boolean;
  disabled: boolean;
}) {
  const t = useTranslations('settings.agents');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const select = (model: string) => {
    onChange(model);
    setSearch('');
    setOpen(false);
  };

  const query = search.trim();
  // Offer the typed text as a custom model id when it does not match a known one.
  const showCustom = query.length > 0 && !models.some((m) => m.id === query);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <AgentComboboxTrigger
        value={value}
        placeholder={t('chooseModel')}
        open={open}
        disabled={disabled}
      />
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput placeholder={t('searchModel')} value={search} onValueChange={setSearch} />
          <CommandList
            className="max-h-[16rem]"
            // The field lives inside a Radix Sheet whose scroll lock blocks wheel
            // events on this portaled list, so scroll it manually on wheel.
            onWheel={(e) => {
              e.currentTarget.scrollTop += e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
            }}
          >
            {!loading && !showCustom && <CommandEmpty>{t('noModels')}</CommandEmpty>}
            {loading && (
              <div className="px-3 py-2 text-sm text-muted-foreground">{t('loadingModels')}</div>
            )}
            {showCustom && (
              <CommandGroup>
                <CommandItem value={query} onSelect={() => select(query)}>
                  {t('useCustomModel', { query })}
                </CommandItem>
              </CommandGroup>
            )}
            {models.length > 0 && (
              <CommandGroup>
                {models.map((m) => (
                  <CommandItem key={m.id} value={`${m.id} ${m.name}`} onSelect={() => select(m.id)}>
                    <span className="flex-1 truncate">
                      <span className="font-mono text-xs">{m.id}</span>
                      {m.name !== m.id && (
                        <span className="ms-2 text-muted-foreground">{m.name}</span>
                      )}
                    </span>
                    {value === m.id && <Check className="ms-auto size-4" />}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
