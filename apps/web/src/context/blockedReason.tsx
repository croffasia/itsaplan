'use client';

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { ApiError } from '@/lib/api/core/client';
import BlockedReasonDialog from '@/components/common/overlay/BlockedReasonDialog';

// The API refuses a move into the blocked column without a reason (400
// blocked_reason_required). A write that may move an issue there sends itself
// through withBlockedReason: on that refusal it asks for the reason and sends again,
// so every place that changes a column (drag, menus, pickers, bulk) asks the same way.

// Thrown when the person closes the dialog. The MutationCache does not toast it.
export class BlockedReasonCanceled extends Error {
  constructor() {
    super('Blocked reason canceled');
    this.name = 'BlockedReasonCanceled';
  }
}

type WithBlockedReason = <T>(send: (blockedReason?: string) => Promise<T>) => Promise<T>;

const BlockedReasonContext = createContext<WithBlockedReason>((send) => send());

export function BlockedReasonProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pending = useRef<((reason: string | null) => void) | null>(null);

  const ask = useCallback(
    () =>
      new Promise<string | null>((resolve) => {
        pending.current?.(null);
        pending.current = resolve;
        setOpen(true);
      }),
    [],
  );

  const settle = (reason: string | null) => {
    pending.current?.(reason);
    pending.current = null;
    setOpen(false);
  };

  const withBlockedReason = useCallback<WithBlockedReason>(
    async (send) => {
      try {
        return await send();
      } catch (error) {
        if (!(error instanceof ApiError) || error.code !== 'blocked_reason_required') throw error;
        const reason = await ask();
        if (reason === null) throw new BlockedReasonCanceled();
        return send(reason);
      }
    },
    [ask],
  );

  return (
    <BlockedReasonContext.Provider value={withBlockedReason}>
      {children}
      {open && <BlockedReasonDialog onSubmit={settle} onClose={() => settle(null)} />}
    </BlockedReasonContext.Provider>
  );
}

export function useWithBlockedReason(): WithBlockedReason {
  return useContext(BlockedReasonContext);
}
