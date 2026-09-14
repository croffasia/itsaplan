import { Loader2, Mic, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { BraindumpCaptureState } from '../hooks/useBraindumpCapture';
import { formatDuration } from '../utils/braindump';

// The Voice half of the capture box: one button that toggles recording, and the
// state around it. The recorder itself lives in the capture hook, so the mic on the
// status card and this panel drive the same recording.
export default function BraindumpVoicePanel({ capture }: { capture: BraindumpCaptureState }) {
  const recording = capture.recorder.state === 'recording';
  const busy = capture.isTranscribing;

  return (
    <div className="flex min-h-[7.5rem] flex-col items-center justify-center gap-3 py-4">
      <Button
        type="button"
        variant={recording ? 'default' : 'outline'}
        size="icon"
        className="size-12 rounded-full"
        disabled={busy || capture.recorder.state === 'unsupported'}
        onClick={() => void (recording ? capture.stopRecording() : capture.startRecording())}
        aria-label={recording ? 'Stop recording' : 'Start recording'}
      >
        {busy ? (
          <Loader2 className="size-5 animate-spin" />
        ) : recording ? (
          <Square className="size-4" />
        ) : (
          <Mic className="size-5" />
        )}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        {busy ? (
          'Transcribing the recording…'
        ) : recording ? (
          <span className="font-medium text-foreground tabular-nums">
            {formatDuration(capture.recorder.elapsedSec) || '0:00'}
          </span>
        ) : capture.recorder.state === 'denied' ? (
          'The browser blocked microphone access. Allow it and try again.'
        ) : capture.recorder.state === 'unsupported' ? (
          'This browser cannot record audio.'
        ) : (
          'Tap to start speaking. The recording is transcribed and filed as a voice memo.'
        )}
      </p>
    </div>
  );
}
