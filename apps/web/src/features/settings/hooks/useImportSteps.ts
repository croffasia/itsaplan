import { useState } from 'react';
import type { ImportStepState } from '../components/import-export/SettingsImportExportStep';

// The steps of an import source, one open at a time: the steps before it are done, the
// steps after it wait for it.
export function useImportSteps<Step extends string>(steps: readonly Step[]) {
  const [open, setOpen] = useState<Step>(steps[0]!);
  const at = steps.indexOf(open);

  function stateOf(index: number): ImportStepState {
    if (index < at) return 'done';
    return index === at ? 'active' : 'pending';
  }

  function step(name: Step) {
    const index = steps.indexOf(name);
    return {
      number: index + 1,
      state: stateOf(index),
      onChange: () => setOpen(name),
      last: index === steps.length - 1,
    };
  }

  return { open: setOpen, step };
}
