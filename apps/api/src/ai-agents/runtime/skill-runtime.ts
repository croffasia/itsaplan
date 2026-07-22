import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getSkillMarkdown, getSkillRefContent, type SkillRow } from '../../agent-skills/store';

// Wires a project's skills into an internal agent run using progressive disclosure:
// the system prompt lists only each enabled skill's name and description, and a
// read_skill tool loads the full SKILL.md (or a reference file) from the object
// store when the agent decides it is relevant. This keeps token cost low regardless
// of how many skills are enabled.

// The system-prompt section describing the enabled skills. Empty string when the
// agent has no skills, so it can be appended unconditionally.
export function skillsPreamble(skills: SkillRow[]): string {
  if (skills.length === 0) return '';
  const lines = skills.map((s) => {
    const refs =
      s.files.length > 0 ? ` Reference files: ${s.files.map((f) => f.path).join(', ')}.` : '';
    return `- [${s.id}] ${s.name}: ${s.description || '(no description)'}${refs}`;
  });
  return [
    '',
    '## Skills',
    'You have access to the following skills. Each is a set of instructions you can',
    'load on demand. When a task matches a skill, call read_skill with its id to load',
    'the full instructions before acting; pass a reference file path to read a',
    'reference. Only load a skill when it is relevant.',
    ...lines,
  ].join('\n');
}

// A read_skill tool restricted to the agent's enabled skills. Reads the SKILL.md by
// default, or a named reference file. Reading is scoped to (projectId, enabled ids)
// so an agent cannot pull skills it was not granted.
export function buildSkillTool(projectId: number, skills: SkillRow[]) {
  const allowed = new Set(skills.map((s) => s.id));
  return {
    read_skill: createTool({
      id: 'read_skill',
      description:
        'Load the full instructions of one of your skills by its id, or a reference ' +
        'file of that skill by passing its path. Use this before applying a skill.',
      inputSchema: z.object({
        skillId: z.number().describe('The id of the skill to load (from the Skills list).'),
        path: z
          .string()
          .optional()
          .describe('Optional reference file path (e.g. refs/example.md); omit for SKILL.md.'),
      }),
      execute: async (input) => {
        const { skillId, path } = input;
        if (!allowed.has(skillId)) {
          return { error: 'That skill is not available to this agent.' };
        }
        try {
          const content = path
            ? await getSkillRefContent(skillId, projectId, path)
            : await getSkillMarkdown(skillId, projectId);
          return { content };
        } catch {
          return { error: 'Could not read that skill or reference file.' };
        }
      },
    }),
  };
}
