import { PRESETS, type PresetKey } from '@/utils/projectPresets';

// Picks the set of issue types a new project starts with and previews the result.
// The preview updates as the selection changes, so the outcome is visible before
// the project exists.
export default function NewProjectPreset({
  value,
  onChange,
}: {
  value: PresetKey;
  onChange: (next: PresetKey) => void;
}) {
  const selected = PRESETS.find((p) => p.key === value) ?? PRESETS[0];

  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium">Issue types</span>

      <div
        role="radiogroup"
        aria-label="Issue types"
        className="grid grid-cols-2 gap-x-2 gap-y-0.5"
      >
        {PRESETS.map((preset) => (
          <button
            key={preset.key}
            type="button"
            role="radio"
            aria-checked={preset.key === value}
            onClick={() => onChange(preset.key)}
            className={`rounded-md px-2 py-1.5 text-left text-sm transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
              preset.key === value
                ? 'bg-secondary font-medium text-secondary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* The type list wraps to two rows at most and the line below is one row, so
          the block keeps its height when the selection changes. */}
      <div className="space-y-2 rounded-lg bg-muted/60 p-3">
        <p className="text-xs text-muted-foreground">
          {selected.types.length} issue {selected.types.length === 1 ? 'type' : 'types'} will be
          created
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
          New issues get {selected.types[0].name} by default. Types are editable in settings.
        </p>
      </div>
    </div>
  );
}
