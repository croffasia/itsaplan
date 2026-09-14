'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import type { BraindumpDestination, BraindumpEntry, BraindumpKind } from '@/lib/api';
import { extractTags } from '../utils/braindump';
import {
  useCaptureBraindump,
  useCaptureBraindumpVoice,
  useRouteBraindumpEntry,
} from '../services/braindump.service';
import { useVoiceRecorder } from './useVoiceRecorder';

export type CaptureMode = 'type' | 'voice';

// The capture panel and the voice card are two views on one draft: the same text,
// kind, mode and recorder. Holding that here keeps a single source of truth and
// lets either view start a recording.
export function useBraindumpCapture(projectKey: string) {
  const [mode, setMode] = useState<CaptureMode>('type');
  const [text, setText] = useState('');
  // Optional. Naming a dump here is what decides its Obsidian file name; left
  // empty, the API derives one from the text.
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<BraindumpKind>('idea');
  const recorder = useVoiceRecorder();
  const capture = useCaptureBraindump(projectKey);
  const captureVoice = useCaptureBraindumpVoice(projectKey);
  const route = useRouteBraindumpEntry(projectKey);

  const { body, tags } = extractTags(text);
  const canSubmit = body.length > 0 && !capture.isPending;

  const submit = useCallback(async (): Promise<BraindumpEntry | null> => {
    if (body.length === 0) return null;
    const named = title.trim();
    const entry = await capture.mutateAsync({
      kind,
      body,
      tags,
      ...(named.length > 0 ? { title: named } : {}),
    });
    setText('');
    setTitle('');
    return entry;
  }, [body, capture, kind, tags, title]);

  // The three destination cards capture and file in one gesture. A failed route
  // leaves the dump in the stream rather than losing it, so only the text is
  // cleared and the error surfaces as a toast.
  const submitTo = useCallback(
    async (destination: BraindumpDestination, extra: { agentId?: number; cron?: string } = {}) => {
      const entry = await submit();
      if (!entry) return;
      await route.mutateAsync({ entryId: entry.id, route: { destination, ...extra } });
    },
    [route, submit],
  );

  const startRecording = useCallback(async () => {
    setMode('voice');
    await recorder.start();
  }, [recorder]);

  const stopRecording = useCallback(async () => {
    const recording = await recorder.stop();
    if (!recording) {
      toast.error('Nothing was recorded');
      return;
    }
    await captureVoice.mutateAsync(recording);
  }, [captureVoice, recorder]);

  return {
    mode,
    setMode,
    text,
    setText,
    title,
    setTitle,
    kind,
    setKind,
    tags,
    canSubmit,
    submit,
    submitTo,
    recorder,
    startRecording,
    stopRecording,
    isSaving: capture.isPending || route.isPending,
    isTranscribing: captureVoice.isPending,
  };
}

export type BraindumpCaptureState = ReturnType<typeof useBraindumpCapture>;
