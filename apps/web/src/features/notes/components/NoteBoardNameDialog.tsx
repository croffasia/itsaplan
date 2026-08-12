'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Modal from '@/components/common/overlay/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { VISIBILITY_ICON, type NewBoardVisibility } from '../utils/visibility';

// A name prompt used for creating and renaming a note board. When `withVisibility`
// is set (creating), it also picks whether the board is public or private.
export default function NoteBoardNameDialog({
  open,
  title,
  description,
  projectKey,
  initial,
  withVisibility = false,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  description?: string;
  projectKey?: string;
  initial: string;
  withVisibility?: boolean;
  onClose: () => void;
  onSubmit: (name: string, visibility: NewBoardVisibility) => void;
}) {
  const t = useTranslations('notes');
  const tCommon = useTranslations('common');
  const [name, setName] = useState(initial);
  const [visibility, setVisibility] = useState<NewBoardVisibility>('public');

  if (!open) return null;

  const isValid = name.trim().length > 0;
  const VisibilityIcon = VISIBILITY_ICON[visibility];

  return (
    <Modal title={title} description={description} projectKey={projectKey} onClose={onClose}>
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (isValid) onSubmit(name.trim(), visibility);
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="board-name">{t('boardName')}</Label>
          <div className="flex gap-2">
            {withVisibility && (
              <button
                type="button"
                aria-label={visibility === 'private' ? t('makePublic') : t('makePrivate')}
                title={t(`visibilityHint.${visibility}`)}
                onClick={() => setVisibility((v) => (v === 'private' ? 'public' : 'private'))}
                className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <VisibilityIcon className="size-4" />
              </button>
            )}
            <Input
              id="board-name"
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('boardNamePlaceholder')}
              className="h-9"
            />
          </div>
        </div>

        {withVisibility && (
          <p className="text-sm text-muted-foreground">
            {visibility === 'private' ? t('privateHint') : t('publicHint')}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {tCommon('cancel')}
          </Button>
          <Button type="submit" disabled={!isValid}>
            {withVisibility ? t('createBoard') : tCommon('save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
