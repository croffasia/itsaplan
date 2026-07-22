import type { HotkeyOverrides } from '@/lib/api';
import { applyOverrides, DEFAULT_COMBOS } from '@/utils/hotkeys';
import { useHotkeySettingsQuery } from '@/services/hotkeys.service';
import HotkeysEditor from '@/components/common/hotkeys/HotkeysEditor';

// The user's own shortcut overrides. They sit on top of the instance bindings, so
// resetting a row falls back to whatever the instance set — not to the built-in
// key. Each change saves immediately, like the rest of the preferences page.
export default function AccountHotkeys({
  overrides,
  onChange,
}: {
  overrides: HotkeyOverrides;
  onChange: (overrides: HotkeyOverrides) => void;
}) {
  // Only once the instance bindings are known: before they arrive the rows would
  // show the built-in combinations as the base, and a conflict with an instance
  // binding would go unreported.
  const { data: instance } = useHotkeySettingsQuery();
  if (!instance) return null;

  return (
    <HotkeysEditor
      base={applyOverrides(DEFAULT_COMBOS, instance)}
      overrides={overrides}
      onChange={onChange}
    />
  );
}
