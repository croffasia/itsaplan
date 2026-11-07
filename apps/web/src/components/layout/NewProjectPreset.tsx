import { useTranslations } from 'next-intl';
import { PRESETS, type PresetKey } from '@/utils/projectPresets';
import NewProjectOption from '@/components/layout/NewProjectOption';

// Picks the set of issue types a blank project starts with and previews the result. The
// preview updates as the selection changes, so the outcome is visible before the project
// exists.
export default function NewProjectPreset({
  value,
  onChange,
}: {
  value: PresetKey;
  onChange: (next: PresetKey) => void;
}) {
  const t = useTranslations('newProject');
  const selected = PRESETS.find((p) => p.key === value) ?? PRESETS[0];

  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium">{t('issueTypes')}</span>

      <div
        role="radiogroup"
        aria-label={t('issueTypes')}
        className="grid grid-cols-2 gap-x-2 gap-y-0.5"
      >
        {PRESETS.map((preset) => (
          <NewProjectOption
            key={preset.key}
            selected={preset.key === value}
            onSelect={() => onChange(preset.key)}
          >
            {t(`presets.${preset.key}`)}
          </NewProjectOption>
        ))}
      </div>

      <div className="space-y-2 rounded-lg bg-muted/60 p-3">
        <p className="text-xs text-muted-foreground">
          {t('typesCreated', { count: selected.types.length })}
        </p>
        <div className="flex min-h-11 flex-wrap content-start gap-x-3 gap-y-1 text-sm">
          {selected.types.map((type) => (
            <span key={type.name} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block size-2 rounded-full"
                style={{ backgroundColor: type.color }}
              />
              {type.name}
            </span>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {t('defaultType', { type: selected.types[0].name })}
        </p>
      </div>
    </div>
  );
}
