'use client';

import { useContext, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ChecklistDraft } from '@/lib/api/endpoints/ai-assist';
import { ShellCtx } from '@/context/shellContext';
import { Button } from '@/components/ui/button';
import { useAiAssistStatusQuery, useDraftChecklist } from '@/services/aiAssist.service';
import AiAssistChecklistDialog from './AiAssistChecklistDialog';

// Hidden while the team has no AI assist model picked.
export default function AiAssistChecklistButton({ issueId }: { issueId: number }) {
  const t = useTranslations('aiAssist.checklist');
  const [draft, setDraft] = useState<ChecklistDraft | null>(null);
  const projectKey = useContext(ShellCtx)?.project?.project.ref ?? '';
  const status = useAiAssistStatusQuery(projectKey);
  const drafting = useDraftChecklist(issueId);
  if (!status.data?.enabled) return null;

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1.5"
        disabled={drafting.isPending}
        onClick={() => drafting.mutate(undefined, { onSuccess: setDraft })}
      >
        <Sparkles className="size-4" /> {t('button')}
      </Button>
      {draft && (
        <AiAssistChecklistDialog issueId={issueId} draft={draft} onClose={() => setDraft(null)} />
      )}
    </>
  );
}
