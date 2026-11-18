import { t } from 'elysia';
import { pageQueryFields, pageResponse } from '#shared/pagination';

export { agentParams } from '../model';

export const skillParams = t.Object({
  teamId: t.Numeric(),
  skillId: t.Numeric({ description: 'Skill id from list_agent_skills.' }),
});

const refPath = t.String({
  description: "Reference file path, such as 'refs/example.md'.",
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
  teamId: t.Number(),
  name: t.String(),
  description: t.String(),
  source: skillSource,
  sourceUrl: t.Nullable(t.String()),
  files: t.Array(SkillRefSchema),
  createdAt: t.String(),
});

export const SkillListResponse = t.Array(SkillResponse);

export const SkillPageResponse = pageResponse(SkillResponse);

export const skillListQuery = t.Object({
  search: t.Optional(
    t.String({
      maxLength: 200,
      description: 'Matches skill name or description.',
    }),
  ),
  source: t.Optional(
    t.String({
      pattern: '^(upload|inline|github)(,(upload|inline|github))*$',
      description: 'Comma-separated sources. Omit for all.',
    }),
  ),
  ...pageQueryFields,
});

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
    t.String({ description: "SKILL.md content. Required unless source is 'github'." }),
  ),
  sourceUrl: t.Optional(
    t.Nullable(
      t.String({
        description:
          'GitHub URL of one skill folder or SKILL.md, from ' +
          "discover_github_skills. Required for source 'github'.",
      }),
    ),
  ),
});

export const updateSkillBody = t.Object({
  name: t.Optional(t.String({ minLength: 1 })),
  description: t.Optional(t.String({ description: 'One line on what the skill is for.' })),
  markdown: t.Optional(t.String({ description: 'Replaces the whole SKILL.md.' })),
});

export const uploadReferenceBody = t.Object({ file: t.File() });

export const updateReferenceBody = t.Object({
  path: refPath,
  content: t.String(),
});

export const setAgentSkillsBody = t.Object({
  skillIds: t.Array(t.Number(), {
    description: 'Skill ids from list_agent_skills. Replaces the whole set.',
  }),
});
