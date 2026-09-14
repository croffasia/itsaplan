'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type RecorderState = 'idle' | 'recording' | 'denied' | 'unsupported';

export interface Recording {
  audio: Blob;
  durationSec: number;
}

// The container the browser records into. Chrome and Firefox both produce webm;
// Safari falls back to whatever it supports, and the API accepts ogg and mp4 too.
function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  for (const type of ['audio/webm', 'audio/ogg', 'audio/mp4']) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return undefined;
}

// Records from the microphone and hands the finished blob back. The caller decides
// what to do with it; this hook owns only the recorder, the stream and the elapsed
// counter, and always releases the microphone when it stops.
export function useVoiceRecorder() {
  const [state, setState] = useState<RecorderState>('idle');
  const [elapsedSec, setElapsedSec] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  // The type asked for, not the one the recorder reports back: webm and mp4 are
  // containers, and a browser recording audio-only into one still reports it as
  // video/*. Labelling the blob with what was requested keeps the upload honest.
  const requestedTypeRef = useRef('audio/webm');

  const release = useCallback(() => {
    recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    recorderRef.current = null;
  }, []);

  // A component unmounted mid-recording must not leave the microphone open.
  useEffect(() => release, [release]);

  useEffect(() => {
    if (state !== 'recording') return;
    const timer = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 250);
    return () => clearInterval(timer);
  }, [state]);

  const start = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      setState('unsupported');
      return;
    }
    const mimeType = pickMimeType();
    if (!mimeType) {
      setState('unsupported');
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setState('denied');
      return;
    }
    const recorder = new MediaRecorder(stream, { mimeType });
    requestedTypeRef.current = mimeType;
    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorderRef.current = recorder;
    startedAtRef.current = Date.now();
    setElapsedSec(0);
    recorder.start();
    setState('recording');
  }, []);

  const stop = useCallback(async (): Promise<Recording | null> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') return null;
    const durationSec = (Date.now() - startedAtRef.current) / 1000;
    const audio = await new Promise<Blob>((resolve) => {
      recorder.onstop = () =>
        resolve(new Blob(chunksRef.current, { type: requestedTypeRef.current }));
      recorder.stop();
    });
    release();
    setState('idle');
    setElapsedSec(0);
    return audio.size > 0 ? { audio, durationSec } : null;
  }, [release]);

  const cancel = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null;
      recorder.stop();
    }
    chunksRef.current = [];
    release();
    setState('idle');
    setElapsedSec(0);
  }, [release]);

  return { state, elapsedSec, start, stop, cancel };
}
