import { HttpError } from '../shared/lib';

// Speech-to-text against a self-hosted Whisper service (the
// openai-whisper-asr-webservice image in the compose files). WHISPER_URL is its
// base origin and comes from the environment, so it is an operator-controlled
// internal address — the SSRF guard in shared/net.ts is for user-supplied URLs and
// deliberately does not apply here.

export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

// Formats a browser MediaRecorder produces, plus the common upload containers.
// Anything else is rejected before it reaches the transcriber. webm, ogg and mp4
// are containers: a browser recording audio-only into one still labels it video/*,
// so those three are accepted under both prefixes. The transcriber reads the
// stream itself, so a video track would simply be ignored.
const ALLOWED_AUDIO_TYPES = [
  'audio/webm',
  'audio/ogg',
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/x-wav',
  'audio/flac',
  'video/webm',
  'video/ogg',
  'video/mp4',
];

export function assertAudioAllowed(size: number, contentType: string): void {
  if (size === 0) throw new HttpError(400, 'Audio file is empty');
  if (size > MAX_AUDIO_BYTES) {
    throw new HttpError(413, `Audio exceeds the ${MAX_AUDIO_BYTES / 1024 / 1024} MB limit`);
  }
  // A browser appends codec parameters ("audio/webm;codecs=opus").
  const base = contentType.split(';')[0].trim().toLowerCase();
  if (!ALLOWED_AUDIO_TYPES.includes(base)) {
    throw new HttpError(415, `Audio type '${base}' is not supported`);
  }
}

export function whisperConfigured(): boolean {
  return Boolean(process.env.WHISPER_URL);
}

export async function transcribeAudio(audio: Blob, filename: string): Promise<string> {
  const base = process.env.WHISPER_URL;
  if (!base) throw new HttpError(503, 'Voice capture is not configured on this instance');

  const url = new URL(`${base.replace(/\/$/, '')}/asr`);
  url.searchParams.set('task', 'transcribe');
  url.searchParams.set('output', 'json');
  url.searchParams.set('encode', 'true');
  const language = process.env.WHISPER_LANGUAGE;
  if (language) url.searchParams.set('language', language);

  const form = new FormData();
  form.append('audio_file', audio, filename);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      body: form,
      // A cold model load plus a few minutes of audio on CPU is slow; a short
      // timeout would fail the first request of every restart.
      signal: AbortSignal.timeout(180_000),
    });
  } catch {
    throw new HttpError(503, 'Transcription service is unavailable');
  }
  if (!response.ok) throw new HttpError(502, 'Transcription service returned an error');

  let text: string;
  try {
    const payload = (await response.json()) as { text?: unknown };
    text = typeof payload.text === 'string' ? payload.text : '';
  } catch {
    throw new HttpError(502, 'Transcription service returned an invalid response');
  }
  return text.trim();
}
