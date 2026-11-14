import { describe, it, expect } from 'bun:test';
import { providerCheck, readAnswer } from '../../provider-check';

describe('providerCheck', () => {
  it('uses the hand-kept check of a provider whose SDK holds its address', () => {
    const check = providerCheck('anthropic', { apiKey: 'sk-ant' });
    expect(check?.url).toBe('https://api.anthropic.com/v1/models');
    expect(check?.auth?.('sk-ant')).toEqual({
      'x-api-key': 'sk-ant',
      'anthropic-version': '2023-06-01',
    });
  });

  it('treats 400 as a refusal where the provider answers a bad key with it', () => {
    expect(providerCheck('google', { apiKey: 'k' })?.rejected).toContain(400);
    expect(providerCheck('xai', { apiKey: 'k' })?.rejected).toContain(400);
  });

  it('asks /models at the address in Mastra’s registry', () => {
    expect(providerCheck('groq', { apiKey: 'k' })).toEqual({
      url: 'https://api.groq.com/openai/v1/models',
    });
  });

  it('asks /models at the base URL the credential carries', () => {
    expect(
      providerCheck('openai-compatible', { apiKey: 'k', baseUrl: 'https://llm.example.com/v1/' }),
    ).toEqual({ url: 'https://llm.example.com/v1/models' });
  });

  it('has no check for a provider with no address to ask', () => {
    expect(providerCheck('openai-compatible', { apiKey: 'k' })).toBeNull();
    expect(providerCheck('not-a-provider', { apiKey: 'k' })).toBeNull();
  });

  it('has no check for a registry address with a placeholder in it', () => {
    expect(providerCheck('cloudflare-workers-ai', { apiKey: 'k' })).toBeNull();
    expect(providerCheck('databricks', { apiKey: 'k' })).toBeNull();
  });
});

describe('readAnswer', () => {
  const answer = (status: number, contentType: string) =>
    new Response(null, { status, headers: { 'content-type': contentType } });

  it('reads a success as valid', () => {
    expect(readAnswer(answer(200, 'application/json'), [401])).toBe('valid');
  });

  it('reads a refusal the API sends as rejected', () => {
    expect(readAnswer(answer(401, 'application/json'), [401, 403])).toBe('rejected');
  });

  it('reads a bot wall page as no answer, not a refusal', () => {
    expect(readAnswer(answer(403, 'text/html'), [401, 403])).toBe('unavailable');
  });

  it('reads an outage as no answer', () => {
    expect(readAnswer(answer(503, 'application/json'), [401, 403])).toBe('unavailable');
  });

  it('reads a missing request as a key that cannot be checked', () => {
    expect(readAnswer(answer(404, 'application/json'), [401, 403])).toBe('unknown');
  });
});
