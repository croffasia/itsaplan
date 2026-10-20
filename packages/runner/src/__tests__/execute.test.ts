import { describe, it, expect } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../config';
import { execute } from '../execute';

describe('command timeout environment', () => {
  it('passes the resolved timeout to each command, including per-agent overrides', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'itsaplan-timeout-'));
    try {
      const path = join(dir, 'runner.json');
      await writeFile(
        path,
        JSON.stringify({
          url: 'http://localhost:3000',
          command: 'printf \'%s\' "$ITSAPLAN_TIMEOUT_MS"',
          timeoutMs: 10800000,
          env: { ITSAPLAN_TIMEOUT_MS: '1500000' },
          agents: [{ apiKey: 'first' }, { apiKey: 'second', timeoutMs: 60000 }],
        }),
      );
      const configs = await loadConfig(path);
      for (const config of configs) {
        const result = await execute(config, {
          prompt: '',
          systemPrompt: '',
          env: { ITSAPLAN_TIMEOUT_MS: '1' },
        });
        expect(result).toEqual({ status: 'success', output: String(config.timeoutMs) });
      }
      expect(configs.map((config) => config.timeoutMs)).toEqual([10800000, 60000]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
