import { Elysia, t } from 'elysia';
import { noContent } from '#shared/http';
import { guards } from '#shared/guards';
import { authContext } from '#shared/auth-context';
import { HttpError } from '#shared/lib';
import { accessErrors, commonErrors, errors } from '#shared/responses';
import { mcpTool } from '#mcp/generate';
import { paginate } from '#shared/pagination';
import { teamParams } from '#modules/teams/model';
import { MAX_SKILL_BYTES, importGithubSkill, discoverGithubSkills } from './skill-format';
import {
  DiscoveredSkillListResponse,
  RefContentResponse,
  SkillListResponse,
  SkillPageResponse,
  skillListQuery,
  SkillMarkdownResponse,
  SkillResponse,
  agentParams,
  createSkillBody,
  discoverSkillsBody,
  refPathQuery,
  setAgentSkillsBody,
  skillParams,
  updateReferenceBody,
  updateSkillBody,
  uploadReferenceBody,
} from './model';
import {
  listSkills,
  listSkillOptions,
  getSkill,
  getSkillMarkdown,
  getSkillRefContent,
  createSkill,
  createSkillFromFiles,
  updateSkill,
  deleteSkill,
  addReference,
  updateReference,
  deleteReference,
  listAgentSkills,
  setAgentSkills,
} from './service';
import { agentInTeam, agentScopeOf, assertFullAgentAccess } from '../core/service';

// Reference-file bytes are capped like the skill markdown.
const MAX_REF_BYTES = MAX_SKILL_BYTES;

// The skill library belongs to the team and serves every project it owns, so the
// routes sit under :teamId, gated by the agent_skills resource on the team: its owner
// and managers always, an owner of one of its projects always, another member when a
// project role of theirs grants it.
//
// Which skills an agent has enabled sits under :teamId too — the agent belongs to the
// team, and only that team's skills may be enabled on it.
export const agentSkillRoutes = new Elysia({
  name: 'agent-skills',
  detail: { tags: ['Agent Skills'] },
})
  .use(authContext)
  .use(guards)

  .get(
    '/teams/:teamId/agent-skills',
    ({ membership, query }) => paginate(query, (window) => listSkills(membership.teamId, window)),
    {
      params: teamParams,
      query: skillListQuery,
      teamPermission: ['agent_skills', 'read'],
      response: { 200: SkillPageResponse, ...accessErrors },
      detail: {
        summary: 'List agent skills',
        description:
          "One page of the team's skill library, each skill with its reference files. The " +
          'whole library, for a picker, comes from list_agent_skill_options.',
        ...mcpTool('list_agent_skills'),
      },
    },
  )

  .get(
    '/teams/:teamId/agent-skills/options',
    ({ membership }) => listSkillOptions(membership.teamId),
    {
      params: teamParams,
      teamPermission: ['agent_skills', 'read'],
      response: { 200: SkillListResponse, ...accessErrors },
      detail: {
        summary: 'List every agent skill',
        description:
          "The team's whole skill library, for the picker that enables skills on an agent. " +
          'Use list_agent_skills to read it a page at a time.',
        ...mcpTool('list_agent_skill_options'),
      },
    },
  )

  .get(
    '/teams/:teamId/agent-skills/:skillId',
    async ({ params, membership }) => {
      const skill = await getSkill(params.skillId, membership.teamId);
      if (!skill) throw new HttpError(404, 'Skill not found');
      return skill;
    },
    {
      params: skillParams,
      teamPermission: ['agent_skills', 'read'],
      response: { 200: SkillResponse, ...accessErrors },
      detail: {
        summary: 'Get an agent skill',
        description:
          "Get a skill's metadata and reference files. The SKILL.md text comes from get_agent_skill_markdown.",
        ...mcpTool('get_agent_skill'),
      },
    },
  )

  // The full SKILL.md content, for the editor and to display the skill.
  .get(
    '/teams/:teamId/agent-skills/:skillId/markdown',
    async ({ params, membership }) => {
      const markdown = await getSkillMarkdown(params.skillId, membership.teamId);
      return { markdown };
    },
    {
      params: skillParams,
      teamPermission: ['agent_skills', 'read'],
      response: { 200: SkillMarkdownResponse, ...accessErrors },
      detail: {
        summary: 'Get skill markdown',
        description: "Get a skill's SKILL.md content.",
        ...mcpTool('get_agent_skill_markdown'),
      },
    },
  )

  // The text content of one reference file, for the editor.
  .get(
    '/teams/:teamId/agent-skills/:skillId/references/content',
    async ({ params, membership, query }) => {
      const content = await getSkillRefContent(params.skillId, membership.teamId, query.path);
      return { content };
    },
    {
      params: skillParams,
      query: refPathQuery,
      teamPermission: ['agent_skills', 'read'],
      response: { 200: RefContentResponse, ...accessErrors },
      detail: {
        summary: 'Get reference file content',
        description: "Get the text of one of a skill's reference files by path.",
        ...mcpTool('get_agent_skill_reference'),
      },
    },
  )

  // Feeds the import picker: the caller chooses which of the found skills to add.
  .post(
    '/teams/:teamId/agent-skills/github/discover',
    ({ body }) => discoverGithubSkills(body.url),
    {
      params: teamParams,
      body: discoverSkillsBody,
      teamPermission: ['agent_skills', 'create'],
      response: { 200: DiscoveredSkillListResponse, ...commonErrors, ...errors(502) },
      detail: {
        summary: 'Discover GitHub skills',
        description:
          'List the skills at a GitHub URL (repo, folder, or file) without importing. Each result carries the URL that imports that one skill through create_agent_skill.',
        // A lookup on GitHub: it stores nothing and reaches outside this tracker.
        ...mcpTool('discover_github_skills', { readOnlyHint: true, openWorldHint: true }),
      },
    },
  )

  .post(
    '/teams/:teamId/agent-skills',
    async ({ membership, body, set }) => {
      if (body.source === 'github') {
        if (!body.sourceUrl)
          throw new HttpError(400, 'A GitHub URL is required for a github skill');
        const imported = await importGithubSkill(body.sourceUrl);
        if (imported.markdown.length > MAX_SKILL_BYTES) {
          throw new HttpError(413, 'Skill markdown is too large');
        }
        set.status = 201;
        return createSkillFromFiles(membership.teamId, {
          name: body.name ?? null,
          description: body.description ?? null,
          markdown: imported.markdown,
          source: 'github',
          sourceUrl: body.sourceUrl,
          refs: imported.refs,
        });
      }

      const markdown = body.markdown ?? '';
      if (!markdown.trim()) throw new HttpError(400, 'Skill markdown is required');
      if (markdown.length > MAX_SKILL_BYTES)
        throw new HttpError(413, 'Skill markdown is too large');
      set.status = 201;
      return createSkill(membership.teamId, {
        name: body.name ?? null,
        description: body.description ?? null,
        markdown,
        source: body.source,
        sourceUrl: body.sourceUrl ?? null,
      });
    },
    {
      params: teamParams,
      body: createSkillBody,
      teamPermission: ['agent_skills', 'create'],
      response: { 201: SkillResponse, ...commonErrors, ...errors(409, 413, 502) },
      detail: {
        summary: 'Create an agent skill',
        description:
          'Create a skill from markdown or by importing a GitHub URL. A GitHub import also brings the markdown reference files next to the SKILL.md.',
        ...mcpTool('create_agent_skill'),
      },
    },
  )

  .patch(
    '/teams/:teamId/agent-skills/:skillId',
    async ({ params, membership, body }) => {
      if (body.markdown !== undefined && body.markdown.length > MAX_SKILL_BYTES) {
        throw new HttpError(413, 'Skill markdown is too large');
      }
      const skill = await updateSkill(params.skillId, membership.teamId, body);
      if (!skill) throw new HttpError(404, 'Skill not found');
      return skill;
    },
    {
      body: updateSkillBody,
      params: skillParams,
      teamPermission: ['agent_skills', 'edit'],
      response: { 200: SkillResponse, ...commonErrors, ...errors(409, 413) },
      detail: {
        summary: 'Update an agent skill',
        description: "Update a skill's name, description, or SKILL.md content.",
        ...mcpTool('update_agent_skill'),
      },
    },
  )

  .delete(
    '/teams/:teamId/agent-skills/:skillId',
    async ({ params, membership }) => {
      const ok = await deleteSkill(params.skillId, membership.teamId);
      if (!ok) throw new HttpError(404, 'Skill not found');
      return noContent();
    },
    {
      params: skillParams,
      teamPermission: ['agent_skills', 'delete'],
      response: { 204: t.Void(), ...accessErrors },
      detail: {
        summary: 'Delete an agent skill',
        description: 'Delete a skill, its reference files, and its links to agents.',
        ...mcpTool('delete_agent_skill'),
      },
    },
  )

  // Uploads a reference file (multipart "file" field). Executable file types are
  // rejected — a skill carries knowledge, not runnable scripts.
  .post(
    '/teams/:teamId/agent-skills/:skillId/references',
    async ({ params, membership, body }) => {
      const file = body.file;
      if (!(file instanceof File)) throw new HttpError(400, 'No file uploaded (form field "file")');
      if (file.size === 0) throw new HttpError(400, 'Uploaded file is empty');
      if (file.size > MAX_REF_BYTES) throw new HttpError(413, 'Reference file is too large');
      const bytes = Buffer.from(await file.arrayBuffer());
      const skill = await addReference(
        params.skillId,
        membership.teamId,
        file.name || 'file',
        bytes,
        file.type || 'application/octet-stream',
      );
      if (!skill) throw new HttpError(404, 'Skill not found');
      return skill;
    },
    {
      body: uploadReferenceBody,
      params: skillParams,
      teamPermission: ['agent_skills', 'edit'],
      response: { 200: SkillResponse, ...commonErrors, ...errors(413) },
      detail: {
        summary: 'Add a reference file',
        description: 'Add a reference file to a skill.',
      },
    },
  )

  // The editor's save of a reference file.
  .patch(
    '/teams/:teamId/agent-skills/:skillId/references/content',
    async ({ params, membership, body }) => {
      const bytes = Buffer.from(body.content, 'utf8');
      if (bytes.length > MAX_REF_BYTES) throw new HttpError(413, 'Reference file is too large');
      const skill = await updateReference(
        params.skillId,
        membership.teamId,
        body.path,
        bytes,
        'text/markdown',
      );
      if (!skill) throw new HttpError(404, 'Skill not found');
      return skill;
    },
    {
      body: updateReferenceBody,
      params: skillParams,
      teamPermission: ['agent_skills', 'edit'],
      response: { 200: SkillResponse, ...commonErrors, ...errors(413) },
      detail: {
        summary: 'Update reference file content',
        description: "Replace the text of a skill's existing reference file, addressed by path.",
        ...mcpTool('update_agent_skill_reference'),
      },
    },
  )

  .delete(
    '/teams/:teamId/agent-skills/:skillId/references',
    async ({ params, membership, query }) => {
      const skill = await deleteReference(params.skillId, membership.teamId, query.path);
      if (!skill) throw new HttpError(404, 'Skill not found');
      return skill;
    },
    {
      params: skillParams,
      query: refPathQuery,
      teamPermission: ['agent_skills', 'edit'],
      response: { 200: SkillResponse, ...accessErrors },
      detail: {
        summary: 'Delete a reference file',
        description: "Delete a skill's reference file by path.",
        ...mcpTool('delete_agent_skill_reference'),
      },
    },
  )

  .get(
    '/teams/:teamId/ai-agents/:agentId/skills',
    async ({ params, membership }) => {
      if (!(await agentInTeam(params.agentId, membership.teamId, agentScopeOf(membership)))) {
        throw new HttpError(404, 'Agent not found');
      }
      return listAgentSkills(params.agentId);
    },
    {
      params: agentParams,
      teamPermission: ['agent_skills', 'read'],
      response: { 200: SkillListResponse, ...accessErrors },
      detail: {
        summary: "List an agent's enabled skills",
        description: 'List the skills enabled on an agent.',
        ...mcpTool('list_ai_agent_skills'),
      },
    },
  )

  .put(
    '/teams/:teamId/ai-agents/:agentId/skills',
    async ({ params, membership, body }) => {
      if (!(await agentInTeam(params.agentId, membership.teamId, agentScopeOf(membership)))) {
        throw new HttpError(404, 'Agent not found');
      }
      await assertFullAgentAccess(membership, params.agentId);
      await setAgentSkills(params.agentId, membership.teamId, body.skillIds);
      return listAgentSkills(params.agentId);
    },
    {
      body: setAgentSkillsBody,
      params: agentParams,
      teamPermission: ['agent_skills', 'edit'],
      response: { 200: SkillListResponse, ...commonErrors },
      detail: {
        summary: "Set an agent's enabled skills",
        description:
          "Replace the set of skills enabled on an agent. Ids that are not skills of the agent's team are ignored.",
        ...mcpTool('set_ai_agent_skills'),
      },
    },
  );
