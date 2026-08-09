import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import type { AccountingPageState } from '../hooks/useAccountingPage';
import { formatMoney } from '../utils/finance';
import AccountingEntryDialog from './AccountingEntryDialog';

export default function AccountingDialogs({
  projectKey,
  state,
}: {
  projectKey: string;
  state: AccountingPageState;
}) {
  const deleting = state.deleting;

  return (
    <>
      {(state.creating || state.editing) && (
        <AccountingEntryDialog
          projectKey={projectKey}
          transaction={state.editing ?? undefined}
          onClose={() => {
            state.setCreating(false);
            state.setEditing(null);
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete bookkeeping entry?"
          confirmLabel="Delete entry"
          onConfirm={async () => {
            await state.remove.mutateAsync(deleting.id);
            state.setDeleting(null);
          }}
          onClose={() => state.setDeleting(null)}
        >
          <p className="text-sm text-muted-foreground">
            This entry of {formatMoney(deleting.amountCents)} will be permanently removed.
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}
