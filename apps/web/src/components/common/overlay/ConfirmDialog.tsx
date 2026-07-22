import { type ReactNode, useState } from 'react';
import Modal from './Modal';
import { Button } from '@/components/ui/button';

// A modal with a destructive confirm button that owns the busy state and the
// try/catch around the action. Callers put the dialog-specific body in `children`
// and supply the action. A failed action is toasted globally; the dialog stays
// open so the user can retry. Used by the delete confirmations (label/type/state/
// project) and the members/roles flows.
export default function ConfirmDialog({
  title,
  children,
  confirmLabel,
  confirmDisabled = false,
  onConfirm,
  onClose,
}: {
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  confirmDisabled?: boolean;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      await onConfirm();
    } catch {
      // The failed action is toasted by the global mutation handler; keep the
      // dialog open so the user can retry or cancel.
      setBusy(false);
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-4">
        {children}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={busy || confirmDisabled}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
