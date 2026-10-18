'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useAiAssistStatusQuery } from '@/services/aiAssist.service';
import AiAssistBoardDialog from './AiAssistBoardDialog';

// Shown on a board with no issues yet, while the team has an AI assist model picked.
export default function AiAssistBoardButton({ projectKey }: { projectKey: string }) {
  const t = useTranslations('aiAssist.board');
  const [open, setOpen] = useState(false);
  const status = useAiAssistStatusQuery(projectKey);
  if (!status.data?.enabled) return null;

  return (
    <div className="flex justify-center border-b px-3 py-2">
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Sparkles className="size-4" />
        {t('button')}
      </Button>
      {open && <AiAssistBoardDialog projectKey={projectKey} onClose={() => setOpen(false)} />}
    </div>
  );
}
