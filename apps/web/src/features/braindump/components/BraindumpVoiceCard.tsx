import { Loader2, Mic, Square } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { BraindumpEntry } from '@/lib/api';
import type { BraindumpCaptureState } from '../hooks/useBraindumpCapture';
import { formatDuration } from '../utils/braindump';

function statusLabel(capture: BraindumpCaptureState, available: boolean): string {
  if (!available) return 'not configured';
  if (capture.isTranscribing) return 'transcribing';
  if (capture.recorder.state === 'recording') return 'recording';
  if (capture.recorder.state === 'denied') return 'microphone blocked';
  if (capture.recorder.state === 'unsupported') return 'not supported here';
  return 'ready';
}

export default function BraindumpVoiceCard({
  capture,
  available,
  lastVoice,
}: {
  capture: BraindumpCaptureState;
  available: boolean;
  lastVoice: BraindumpEntry | null;
}) {
  const recording = capture.recorder.state === 'recording';
  const busy = capture.isTranscribing;
  const disabled = !available || busy || capture.recorder.state === 'unsupported';

  return (
    <Card className="gap-3 py-5 shadow-none">
      <CardContent className="flex h-full flex-col px-5">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'size-1.5 rounded-full',
              recording ? 'bg-foreground' : 'bg-muted-foreground/50',
            )}
          />
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Voice capture · {statusLabel(capture, available)}
          </span>
        </div>

        <div className="mt-4 flex items-start gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-10 rounded-full"
            disabled={disabled}
            onClick={() => void (recording ? capture.stopRecording() : capture.startRecording())}
            aria-label={recording ? 'Stop recording' : 'Start recording'}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : recording ? (
              <Square className="size-3.5" />
            ) : (
              <Mic className="size-4" />
            )}
          </Button>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {recording ? (
              <>
                Recording ·{' '}
                <span className="font-medium text-foreground tabular-nums">
                  {formatDuration(capture.recorder.elapsedSec) || '0:00'}
                </span>
                <br />
                Tap the square to stop and transcribe.
              </>
            ) : available ? (
              <>
                Tap to dictate · <span className="font-medium text-foreground">transcribed</span> by
                Whisper on this instance, then filed to the stream.
              </>
            ) : (
              <>
                Set <span className="font-medium text-foreground">WHISPER_URL</span> to record and
                transcribe from this page.
              </>
            )}
          </p>
        </div>

        <p className="mt-auto pt-4 text-xs text-muted-foreground">
          {lastVoice ? (
            <>
              Last memo ·{' '}
              <span className="tabular-nums">{formatDuration(lastVoice.audioDurationSec)}</span>{' '}
              &quot;{lastVoice.title}&quot;
            </>
          ) : (
            'No voice memo captured yet.'
          )}
        </p>
      </CardContent>
    </Card>
  );
}
