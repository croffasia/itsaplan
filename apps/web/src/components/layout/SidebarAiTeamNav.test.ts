import { describe, expect, it } from 'bun:test';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('./SidebarAiTeamNav.tsx', import.meta.url), 'utf8');

describe('SidebarAiTeamNav', () => {
  it('places Agents directly after Chat', () => {
    const chat = source.indexOf('label="Chat"');
    const agents = source.indexOf('label="Agents"');

    expect(chat).toBeGreaterThan(-1);
    expect(agents).toBeGreaterThan(chat);
    expect(source.slice(chat + 'label="Chat"'.length, agents)).not.toContain('label="');
  });
});
