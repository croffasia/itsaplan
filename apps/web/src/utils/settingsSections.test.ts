import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Bot } from 'lucide-react';
import { aiTeamEntries, type SettingsSection } from './settingsSections';

const section = (slug: string, menu?: string): SettingsSection => ({
  slug,
  icon: Bot,
  resource: 'ai_agents',
  group: 'ai-team',
  menu,
});

describe('aiTeamEntries', () => {
  it('folds the sections of one menu into one entry, where the first of them is', () => {
    const entries = aiTeamEntries([
      section('schedules'),
      section('flows', 'flows'),
      section('reports'),
      section('flow-runs', 'flows'),
    ]);
    assert.deepEqual(
      entries.map((entry) =>
        'section' in entry
          ? entry.section.slug
          : `${entry.menu}: ${entry.sections.map((s) => s.slug).join(', ')}`,
      ),
      ['schedules', 'flows: flows, flow-runs', 'reports'],
    );
  });
});
