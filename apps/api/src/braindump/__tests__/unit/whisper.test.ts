import { describe, expect, it } from 'bun:test';
import { assertAudioAllowed, MAX_AUDIO_BYTES } from '../../whisper';
import { HttpError } from '../../../shared/lib';

function reject(size: number, type: string): HttpError {
  try {
    assertAudioAllowed(size, type);
  } catch (err) {
    return err as HttpError;
  }
  throw new Error(`expected ${size}/${type} to be rejected`);
}

describe('assertAudioAllowed', () => {
  it('accepts the formats a browser records into', () => {
    for (const type of ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/wav']) {
      expect(() => assertAudioAllowed(1024, type)).not.toThrow();
    }
  });

  // A browser recording audio-only into a webm or mp4 container labels the blob
  // video/*; rejecting that would refuse every recording Chrome makes.
  it('accepts a container labelled video/*', () => {
    for (const type of ['video/webm', 'video/ogg', 'video/mp4']) {
      expect(() => assertAudioAllowed(1024, type)).not.toThrow();
    }
  });

  it('ignores codec parameters and casing', () => {
    expect(() => assertAudioAllowed(1024, 'audio/webm;codecs=opus')).not.toThrow();
    expect(() => assertAudioAllowed(1024, 'VIDEO/WEBM; codecs=opus')).not.toThrow();
  });

  it('rejects a type that is not audio at all', () => {
    expect(reject(1024, 'application/zip').status).toBe(415);
    expect(reject(1024, 'image/png').status).toBe(415);
  });

  it('rejects an empty file and one over the limit', () => {
    expect(reject(0, 'audio/webm').status).toBe(400);
    expect(reject(MAX_AUDIO_BYTES + 1, 'audio/webm').status).toBe(413);
    expect(() => assertAudioAllowed(MAX_AUDIO_BYTES, 'audio/webm')).not.toThrow();
  });
});
