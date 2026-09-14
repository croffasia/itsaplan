import { Check, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { BraindumpCaptureState } from '../hooks/useBraindumpCapture';
import BraindumpKindPicker from './BraindumpKindPicker';
import BraindumpModeToggle from './BraindumpModeToggle';
import BraindumpVoicePanel from './BraindumpVoicePanel';

export default function BraindumpCapture({
  capture,
  voiceAvailable,
  canCreate,
}: {
  capture: BraindumpCaptureState;
  voiceAvailable: boolean;
  canCreate: boolean;
}) {
  return (
    <Card className="gap-0 py-0 shadow-none">
      <CardContent className="space-y-3 p-4">
        <BraindumpModeToggle
          mode={capture.mode}
          voiceAvailable={voiceAvailable}
          onChange={capture.setMode}
        />

        {capture.mode === 'voice' ? (
          <BraindumpVoicePanel capture={capture} />
        ) : (
          <>
            <Input
              value={capture.title}
              onChange={(event) => capture.setTitle(event.target.value)}
              placeholder="Name it (optional) — this becomes the note title"
              disabled={!canCreate}
              maxLength={200}
              className="h-9 border-0 px-0 text-sm font-medium shadow-none focus-visible:ring-0 dark:bg-transparent"
            />
            <Textarea
              value={capture.text}
              onChange={(event) => capture.setText(event.target.value)}
              onKeyDown={(event) => {
                if (
                  (event.metaKey || event.ctrlKey) &&
                  event.key === 'Enter' &&
                  capture.canSubmit
                ) {
                  event.preventDefault();
                  void capture.submit();
                }
              }}
              placeholder="What's on your mind…"
              disabled={!canCreate}
              className="min-h-[7.5rem] resize-y border-0 px-0 text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
            />
          </>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {capture.tags.length === 0 ? (
              <span className="text-xs text-muted-foreground">
                Type <span className="font-medium text-foreground">#tag</span> in the text to file
                it under one.
              </span>
            ) : (
              capture.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="font-normal">
                  #{tag}
                </Badge>
              ))
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            <kbd className="rounded border px-1 py-0.5 font-sans text-[0.7rem]">⌘</kbd>
            <kbd className="ml-1 rounded border px-1 py-0.5 font-sans text-[0.7rem]">↵</kbd> to save
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
          <BraindumpKindPicker value={capture.kind} onChange={capture.setKind} />
          <Button
            type="button"
            size="sm"
            disabled={!capture.canSubmit || !canCreate}
            onClick={() => void capture.submit()}
          >
            {capture.isSaving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            Capture
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
