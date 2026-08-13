import { Elysia, t } from 'elysia';
import { noContent } from '#shared/http';
import { guards } from '#shared/guards';
import { authContext } from '#shared/auth-context';
import { HttpError } from '#shared/lib';
import { accessErrors, commonErrors, errors } from '#shared/responses';
import { mcpTool } from '#mcp/generate';
import { MAX_SKILL_BYTES, importGithubSkill, discoverGithubSkills } from './skill-format';
import {
  DiscoveredSkillListResponse,
  RefContentResponse,
  SkillListResponse,
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
import { agentInProject } from '../core/service';

// Reference-file bytes are capped like the skill markdown.
const MAX_REF_BYTES = MAX_SKILL_BYTES;

// Gated under the agent_skills resource (the project skill library).
export const agentSkillRoutes = new Elysia({
  name: 'agent-skills',
  detail: { tags: ['Agent Skills'] },
})
  .use(authContext)
  .use(guards)

  .get('/projects/:projectKey/agent-skills', ({ project }) => listSkills(project.id), {
    permission: ['agent_skills', 'read'],
    response: { 200: SkillListResponse, ...accessErrors },
    detail: {
      summary: 'List agent skills',
      description: "List the project's skill library, each skill with its reference files.",
      ...mcpTool('list_agent_skills'),
    },
  })

  .get(
    '/projects/:projectKey/agent-skills/:skillId',
    async ({ params, project }) => {
      const skill = await getSkill(params.skillId, project.id);
      if (!skill) throw new HttpError(404, 'Skill not found');
      return skill;
    },
    {
      params: skillParams,
      permission: ['agent_skills', 'read'],
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
    '/projects/:projectKey/agent-skills/:skillId/markdown',
    async ({ params, project }) => {
      const markdown = await getSkillMarkdown(params.skillId, project.id);
      return { markdown };
    },
    {
      params: skillParams,
      permission: ['agent_skills', 'read'],
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
    '/projects/:projectKey/agent-skills/:skillId/references/content',
    async ({ params, project, query }) => {
      const content = await getSkillRefContent(params.skillId, project.id, query.path);
      return { content };
    },
    {
      params: skillParams,
      query: refPathQuery,
      permission: ['agent_skills', 'read'],
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
    '/projects/:projectKey/agent-skills/github/discover',
    ({ body }) => discoverGithubSkills(body.url),
    {
      body: discoverSkillsBody,
      permission: ['agent_skills', 'create'],
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
    '/projects/:projectKey/agent-skills',
    async ({ project, body, set }) => {
      if (body.source === 'github') {
        if (!body.sourceUrl)
          throw new HttpError(400, 'A GitHub URL is required for a github skill');
        const imported = await importGithubSkill(body.sourceUrl);
        if (imported.markdown.length > MAX_SKILL_BYTES) {
          throw new HttpError(413, 'Skill markdown is too large');
        }
        set.status = 201;
        return createSkillFromFiles(project.id, {
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
      return createSkill(project.id, {
        name: body.name ?? null,
        description: body.description ?? null,
        markdown,
        source: body.source,
        sourceUrl: body.sourceUrl ?? null,
      });
    },
    {
      body: createSkillBody,
      permission: ['agent_skills', 'create'],
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
    '/projects/:projectKey/agent-skills/:skillId',
    async ({ params, project, body }) => {
      if (body.markdown !== undefined && body.markdown.length > MAX_SKILL_BYTES) {
        throw new HttpError(413, 'Skill markdown is too large');
      }
      const skill = await updateSkill(params.skillId, project.id, body);
      if (!skill) throw new HttpError(404, 'Skill not found');
      return skill;
    },
    {
      body: updateSkillBody,
      params: skillParams,
      permission: ['agent_skills', 'edit'],
      response: { 200: SkillResponse, ...commonErrors, ...errors(409, 413) },
      detail: {
        summary: 'Update an agent skill',
        description: "Update a skill's name, description, or SKILL.md content.",
        ...mcpTool('update_agent_skill'),
      },
    },
  )

  .delete(
    '/projects/:projectKey/agent-skills/:skillId',
    async ({ params, project }) => {
      const ok = await deleteSkill(params.skillId, project.id);
      if (!ok) throw new HttpError(404, 'Skill not found');
      return noContent();
    },
    {
      params: skillParams,
      permission: ['agent_skills', 'delete'],
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
    '/projects/:projectKey/agent-skills/:skillId/references',
    async ({ params, project, body }) => {
      const file = body.file;
      if (!(file instanceof File)) throw new HttpError(400, 'No file uploaded (form field "file")');
      if (file.size === 0) throw new HttpError(400, 'Uploaded file is empty');
      if (file.size > MAX_REF_BYTES) throw new HttpError(413, 'Reference file is too large');
      const bytes = Buffer.from(await file.arrayBuffer());
      const skill = await addReference(
        params.skillId,
        project.id,
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
      permission: ['agent_skills', 'edit'],
      response: { 200: SkillResponse, ...commonErrors, ...errors(413) },
      detail: {
        summary: 'Add a reference file',
        description: 'Add a reference file to a skill.',
      },
    },
  )

  // The editor's save of a reference file.
  .patch(
    '/projects/:projectKey/agent-skills/:skillId/references/content',
    async ({ params, project, body }) => {
      const bytes = Buffer.from(body.content, 'utf8');
      if (bytes.length > MAX_REF_BYTES) throw new HttpError(413, 'Reference file is too large');
      const skill = await updateReference(
        params.skillId,
        project.id,
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
      permission: ['agent_skills', 'edit'],
      response: { 200: SkillResponse, ...commonErrors, ...errors(413) },
      detail: {
        summary: 'Update reference file content',
        description: "Replace the text of a skill's existing reference file, addressed by path.",
        ...mcpTool('update_agent_skill_reference'),
      },
    },
  )

  .delete(
    '/projects/:projectKey/agent-skills/:skillId/references',
    async ({ params, project, query }) => {
      const skill = await deleteReference(params.skillId, project.id, query.path);
      if (!skill) throw new HttpError(404, 'Skill not found');
      return skill;
    },
    {
      params: skillParams,
      query: refPathQuery,
      permission: ['agent_skills', 'edit'],
      response: { 200: SkillResponse, ...accessErrors },
      detail: {
        summary: 'Delete a reference file',
        description: "Delete a skill's reference file by path.",
        ...mcpTool('delete_agent_skill_reference'),
      },
    },
  )

  .get(
    '/projects/:projectKey/ai-agents/:agentId/skills',
    async ({ params, project }) => {
      if (!(await agentInProject(params.agentId, project.id))) {
        throw new HttpError(404, 'Agent not found');
      }
      return listAgentSkills(params.agentId);
    },
    {
      params: agentParams,
      permission: ['agent_skills', 'read'],
      response: { 200: SkillListResponse, ...accessErrors },
      detail: {
        summary: "List an agent's enabled skills",
        description: 'List the skills enabled on an agent.',
        ...mcpTool('list_ai_agent_skills'),
      },
    },
  )

  .put(
    '/projects/:projectKey/ai-agents/:agentId/skills',
    async ({ params, project, body }) => {
      if (!(await agentInProject(params.agentId, project.id))) {
        throw new HttpError(404, 'Agent not found');
      }
      await setAgentSkills(params.agentId, project.id, body.skillIds);
      return listAgentSkills(params.agentId);
    },
    {
      body: setAgentSkillsBody,
      params: agentParams,
      permission: ['agent_skills', 'edit'],
      response: { 200: SkillListResponse, ...commonErrors },
      detail: {
        summary: "Set an agent's enabled skills",
        description:
          'Replace the set of skills enabled on an agent. Ids that are not skills of this project are ignored.',
        ...mcpTool('set_ai_agent_skills'),
      },
    },
  );
