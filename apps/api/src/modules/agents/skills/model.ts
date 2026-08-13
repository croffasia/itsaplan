import { t } from 'elysia';

export { agentParams } from '../model';

export const skillParams = t.Object({
  projectKey: t.String(),
  skillId: t.Numeric({ description: 'Skill id from list_agent_skills.' }),
});

const refPath = t.String({
  description: "Reference file path from the skill's files, e.g. 'refs/example.md'.",
});

export const refPathQuery = t.Object({ path: refPath });

const skillSource = t.Union([t.Literal('upload'), t.Literal('inline'), t.Literal('github')]);

const SkillRefSchema = t.Object({
  path: t.String(),
  s3Key: t.String(),
  size: t.Number(),
});

export const SkillResponse = t.Object({
  id: t.Number(),
  projectId: t.Number(),
  name: t.String(),
  description: t.String(),
  source: skillSource,
  sourceUrl: t.Nullable(t.String()),
  files: t.Array(SkillRefSchema),
  createdAt: t.String(),
});

export const SkillListResponse = t.Array(SkillResponse);

export const SkillMarkdownResponse = t.Object({ markdown: t.String() });

export const RefContentResponse = t.Object({ content: t.String() });

export const DiscoveredSkillListResponse = t.Array(
  t.Object({
    name: t.String(),
    description: t.String(),
    subpath: t.String(),
    url: t.String(),
  }),
);

export const discoverSkillsBody = t.Object({
  url: t.String({ description: 'GitHub URL of a repo, a folder, or a SKILL.md file.' }),
});

export const createSkillBody = t.Object({
  source: t.Union([t.Literal('upload'), t.Literal('inline'), t.Literal('github')], {
    description:
      "'inline' for markdown written here, 'upload' for markdown from a file, 'github' to import from sourceUrl.",
  }),
  name: t.Optional(
    t.Nullable(t.String({ description: 'Defaults to the SKILL.md frontmatter name.' })),
  ),
  description: t.Optional(
    t.Nullable(t.String({ description: 'Defaults to the SKILL.md frontmatter description.' })),
  ),
  markdown: t.Optional(
    t.String({ description: "SKILL.md content; required unless source is 'github'." }),
  ),
  sourceUrl: t.Optional(
    t.Nullable(
      t.String({
        description:
          "GitHub URL of one skill folder or SKILL.md, from discover_github_skills; required for source 'github'.",
      }),
    ),
  ),
});

export const updateSkillBody = t.Object({
  name: t.Optional(t.String({ minLength: 1, description: 'New skill name.' })),
  description: t.Optional(
    t.String({ description: 'New one-line description of what the skill is for.' }),
  ),
  markdown: t.Optional(t.String({ description: 'Replaces the SKILL.md content whole.' })),
});

export const uploadReferenceBody = t.Object({ file: t.File() });

export const updateReferenceBody = t.Object({
  path: refPath,
  content: t.String({ description: 'The new file text.' }),
});

export const setAgentSkillsBody = t.Object({
  skillIds: t.Array(t.Number(), {
    description:
      'Skill ids from list_agent_skills. Replaces the whole set, so send every skill that stays enabled.',
  }),
});
