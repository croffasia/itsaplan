import { useTranslations } from 'next-intl';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { PaletteSearchScope } from './hooks/usePaletteSearchScope';

const SCOPES: { value: PaletteSearchScope; label: 'scopeCurrent' | 'scopeAll' }[] = [
  { value: 'current', label: 'scopeCurrent' },
  { value: 'all', label: 'scopeAll' },
];

// The palette's search scope switch. A trigger takes no focus on press, so the
// search input keeps it and the arrow keys keep moving through the results; Radix
// skips its own press handler then, so the click selects. A focused trigger keeps
// Enter from the palette, which would otherwise run the selected command.
export default function CommandPaletteScope({
  scope,
  onChange,
}: {
  scope: PaletteSearchScope;
  onChange: (scope: PaletteSearchScope) => void;
}) {
  const t = useTranslations('palette');
  return (
    <div className="flex items-center gap-2 border-b px-3 py-1.5 text-xs text-muted-foreground">
      <span>{t('searchScope')}</span>
      <Tabs value={scope} onValueChange={(next) => onChange(next as PaletteSearchScope)}>
        <TabsList aria-label={t('searchScope')} className="h-7">
          {SCOPES.map(({ value, label }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="px-2.5 text-xs"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onChange(value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.stopPropagation();
              }}
            >
              {t(label)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
