'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { BoardDraft } from '@/lib/api/endpoints/ai-assist';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useApplyBoard, useDraftBoard } from '@/services/aiAssist.service';
import AiAssistBoardPreview from './AiAssistBoardPreview';

export default function AiAssistBoardDialog({
  projectKey,
  onClose,
}: {
  projectKey: string;
  onClose: () => void;
}) {
  const t = useTranslations('aiAssist.board');
  const [prompt, setPrompt] = useState('');
  const [draft, setDraft] = useState<BoardDraft | null>(null);
  const drafting = useDraftBoard(projectKey);
  const applying = useApplyBoard(projectKey);

  const generate = () => drafting.mutate(prompt.trim(), { onSuccess: setDraft });
  const confirm = () =>
    draft &&
    applying.mutate(draft, {
      onSuccess: () => {
        toast.success(t('created'));
        onClose();
      },
    });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        <Textarea
          value={prompt}
          maxLength={2000}
          rows={3}
          dir="auto"
          placeholder={t('promptPlaceholder')}
          onChange={(e) => setPrompt(e.target.value)}
        />
        {draft && <AiAssistBoardPreview draft={draft} />}
        <DialogFooter>
          <Button
            variant={draft ? 'outline' : 'default'}
            disabled={!prompt.trim() || drafting.isPending}
            onClick={generate}
          >
            {draft ? t('regenerate') : t('generate')}
          </Button>
          {draft && (
            <Button disabled={applying.isPending || drafting.isPending} onClick={confirm}>
              {t('confirm', { columns: draft.columns.length, issues: draft.issues.length })}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
