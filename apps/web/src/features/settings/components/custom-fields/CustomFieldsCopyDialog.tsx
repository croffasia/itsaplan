'use client';

import Modal from '@/components/common/overlay/Modal';
import { Button } from '@/components/ui/button';

// Asks, before copying, whether to include the type-scoped fields or copy only the
// global ones. Shown only when the project has type-scoped fields.
export default function CustomFieldsCopyDialog({
  globalCount,
  scopedCount,
  onChoose,
  onClose,
}: {
  globalCount: number;
  scopedCount: number;
  onChoose: (includeTypeScoped: boolean) => void;
  onClose: () => void;
}) {
  return (
    <Modal title="Copy custom fields" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          This project has {scopedCount} field{scopedCount === 1 ? '' : 's'} scoped to an issue
          type. Copy those too, or only the {globalCount} global field
          {globalCount === 1 ? '' : 's'}?
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onChoose(false)} disabled={globalCount === 0}>
            Global only
          </Button>
          <Button onClick={() => onChoose(true)}>Include type-scoped</Button>
        </div>
      </div>
    </Modal>
  );
}
