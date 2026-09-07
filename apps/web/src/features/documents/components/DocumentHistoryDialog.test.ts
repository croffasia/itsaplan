import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canApplyDocumentHistoryRestore,
  canInteractWithDocumentHistory,
} from './DocumentHistoryDialog';

describe('DocumentHistoryDialog restore guard', () => {
  it('allows interaction only when no restore owns the dialog', () => {
    assert.equal(canInteractWithDocumentHistory(null), true);
    assert.equal(canInteractWithDocumentHistory(0), false);
    assert.equal(canInteractWithDocumentHistory(42), false);
  });

  it('accepts the active restore while the dialog is mounted and open', () => {
    assert.equal(
      canApplyDocumentHistoryRestore({
        attempt: 2,
        currentAttempt: 2,
        open: true,
        mounted: true,
      }),
      true,
    );
  });

  it('rejects restore results after the dialog closes', () => {
    assert.equal(
      canApplyDocumentHistoryRestore({
        attempt: 2,
        currentAttempt: 2,
        open: false,
        mounted: true,
      }),
      false,
    );
  });

  it('rejects an older result after a new attempt starts', () => {
    assert.equal(
      canApplyDocumentHistoryRestore({
        attempt: 2,
        currentAttempt: 3,
        open: true,
        mounted: true,
      }),
      false,
    );
  });

  it('rejects restore results after unmount', () => {
    assert.equal(
      canApplyDocumentHistoryRestore({
        attempt: 2,
        currentAttempt: 2,
        open: true,
        mounted: false,
      }),
      false,
    );
  });
});
