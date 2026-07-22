import type { HotkeyOverrides } from '@/lib/api';
import { HOTKEYS, type HotkeyCombos, type HotkeyDef, type HotkeyId } from '@/utils/hotkeys';
import HotkeysEditorRow from './HotkeysEditorRow';

// The shortcut list, grouped as the hotkey map declares. `base` is what applies
// without the overrides being edited (the built-in bindings in god mode, the
// instance bindings on the account screen), so resetting a row falls back to it.
// Rebinding to a combination already in use is refused by the row's parent through
// the conflict it reports here.
export default function HotkeysEditor({
  base,
  overrides,
  onChange,
}: {
  base: HotkeyCombos;
  overrides: HotkeyOverrides;
  onChange: (overrides: HotkeyOverrides) => void;
}) {
  const effective = (id: HotkeyId) => overrides[id] ?? base[id];

  // The command already bound to a combination, so a duplicate is visible before it
  // is saved rather than leaving one of the two unreachable.
  const conflictFor = (def: HotkeyDef): string | null => {
    const combo = effective(def.id);
    const other = HOTKEYS.find((h) => h.id !== def.id && effective(h.id) === combo);
    return other ? other.label : null;
  };

  const groups = [...new Set(HOTKEYS.map((h) => h.group))];

  function record(id: HotkeyId, combo: string) {
    onChange({ ...overrides, [id]: combo });
  }

  function reset(id: HotkeyId) {
    const next = { ...overrides };
    delete next[id];
    onChange(next);
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group}>
          <p className="mb-1 text-xs font-medium text-muted-foreground">{group}</p>
          <div className="divide-y divide-border/60">
            {HOTKEYS.filter((h) => h.group === group).map((def) => (
              <HotkeysEditorRow
                key={def.id}
                def={def}
                combo={effective(def.id)}
                overridden={overrides[def.id] != null}
                conflictWith={conflictFor(def)}
                onRecord={(combo) => record(def.id, combo)}
                onReset={() => reset(def.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
