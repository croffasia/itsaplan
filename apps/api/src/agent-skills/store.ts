import { db, agentSkill, agentSkillLink, aiAgent } from '@repo/db';
import { and, eq, inArray } from 'drizzle-orm';
import { iso, rethrowDuplicate, HttpError } from '../shared/lib';
import { putObject, getObjectText, deleteObjects } from '../shared/s3';
import { parseFrontmatter, isDisallowedRef } from './skill-format';

// Data access for the project skill library. A skill's SKILL.md and reference files
// live in the S3 object store under s3_prefix; the row holds metadata and the list
// of reference files. Content is read from S3 on demand (the runtime pulls it
// through a tool; the editor pulls it to display). Skills are linked to agents
// through agent_skill_link.

export type SkillSource = 'upload' | 'inline' | 'github';

export interface SkillRef {
  path: string; // relative path, e.g. "refs/example.md"
  s3Key: string;
  size: number;
}

export interface SkillRow {
  id: number;
  projectId: number;
  name: string;
  description: string;
  source: SkillSource;
  sourceUrl: string | null;
  files: SkillRef[];
  createdAt: string;
}

const dtoColumns = {
  id: agentSkill.id,
  projectId: agentSkill.projectId,
  name: agentSkill.name,
  description: agentSkill.description,
  source: agentSkill.source,
  sourceUrl: agentSkill.sourceUrl,
  files: agentSkill.files,
  createdAt: agentSkill.createdAt,
};

function mapRow(row: {
  id: number;
  projectId: number;
  name: string;
  description: string;
  source: string;
  sourceUrl: string | null;
  files: unknown;
  createdAt: Date;
}): SkillRow {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    description: row.description,
    source: row.source as SkillSource,
    sourceUrl: row.sourceUrl,
    files: Array.isArray(row.files) ? (row.files as SkillRef[]) : [],
    createdAt: iso(row.createdAt),
  };
}

function skillMdKey(prefix: string): string {
  return `${prefix}/SKILL.md`;
}

export async function listSkills(projectId: number): Promise<SkillRow[]> {
  const rows = await db
    .select(dtoColumns)
    .from(agentSkill)
    .where(eq(agentSkill.projectId, projectId))
    .orderBy(agentSkill.name);
  return rows.map(mapRow);
}

export async function getSkill(id: number, projectId: number): Promise<SkillRow | null> {
  const rows = await db
    .select(dtoColumns)
    .from(agentSkill)
    .where(and(eq(agentSkill.id, id), eq(agentSkill.projectId, projectId)));
  return rows[0] ? mapRow(rows[0]) : null;
}

// The full SKILL.md markdown from the object store. 404 if the skill is missing.
export async function getSkillMarkdown(id: number, projectId: number): Promise<string> {
  const skill = await getSkillRow(id, projectId);
  return getObjectText(skillMdKey(skill.s3Prefix));
}

// The content of one reference file of a skill, addressed by its relative path.
export async function getSkillRefContent(
  id: number,
  projectId: number,
  path: string,
): Promise<string> {
  const skill = await getSkillRow(id, projectId);
  const ref = (skill.files as SkillRef[]).find((f) => f.path === path);
  if (!ref) throw new HttpError(404, 'Reference file not found');
  return getObjectText(ref.s3Key);
}

// Loads the raw row (including s3_prefix, not in the DTO) or throws 404.
async function getSkillRow(id: number, projectId: number) {
  const rows = await db
    .select()
    .from(agentSkill)
    .where(and(eq(agentSkill.id, id), eq(agentSkill.projectId, projectId)));
  const row = rows[0];
  if (!row) throw new HttpError(404, 'Skill not found');
  return row;
}

export interface NewSkillInput {
  // When omitted, name/description are taken from the SKILL.md frontmatter.
  name?: string | null;
  description?: string | null;
  markdown: string;
  source: SkillSource;
  sourceUrl?: string | null;
}

// Creates a skill: writes SKILL.md to the object store, then inserts the row. name
// and description default to the frontmatter values; a skill with no resolvable name
// is a 400.
export async function createSkill(projectId: number, input: NewSkillInput): Promise<SkillRow> {
  return createSkillFromFiles(projectId, { ...input, refs: [] });
}

export interface ImportedRefInput {
  path: string; // relative to the skill folder, e.g. "references/example.md"
  bytes: Buffer;
  contentType: string;
}

export interface NewSkillFromFilesInput extends NewSkillInput {
  refs: ImportedRefInput[];
}

// Keeps a relative reference path safe as an object key: rejects traversal and
// unusual characters, and drops disallowed (executable) file types. Returns null
// when the path cannot be used.
function sanitizeRefPath(path: string): string | null {
  const segs = path.split('/').filter((s) => s && s !== '.');
  if (segs.length === 0) return null;
  if (segs.some((s) => s === '..' || !/^[A-Za-z0-9._-]+$/.test(s))) return null;
  const rel = segs.join('/');
  return isDisallowedRef(segs[segs.length - 1]) ? null : rel;
}

// Creates a skill together with its reference files in one operation (used by the
// GitHub import). SKILL.md and each reference are written to the object store with
// their relative paths preserved, then the row is inserted. On any failure the
// written objects are removed so no orphans remain.
export async function createSkillFromFiles(
  projectId: number,
  input: NewSkillFromFilesInput,
): Promise<SkillRow> {
  const fm = parseFrontmatter(input.markdown);
  const name = (input.name ?? fm.name ?? '').trim();
  if (!name) {
    throw new HttpError(400, 'Skill needs a name (in the request or SKILL.md frontmatter)');
  }
  const description = (input.description ?? fm.description ?? '').trim();
  const prefix = `skills/${projectId}/${crypto.randomUUID()}`;

  const written: string[] = [];
  const files: SkillRef[] = [];
  try {
    const mdKey = skillMdKey(prefix);
    await putObject(mdKey, Buffer.from(input.markdown, 'utf8'), 'text/markdown');
    written.push(mdKey);

    for (const ref of input.refs) {
      const rel = sanitizeRefPath(ref.path);
      if (!rel) continue;
      const s3Key = `${prefix}/${rel}`;
      await putObject(s3Key, ref.bytes, ref.contentType || 'application/octet-stream');
      written.push(s3Key);
      files.push({ path: rel, s3Key, size: ref.bytes.length });
    }

    const [row] = await db
      .insert(agentSkill)
      .values({
        projectId,
        name,
        description,
        source: input.source,
        sourceUrl: input.sourceUrl ?? null,
        s3Prefix: prefix,
        files,
      })
      .returning(dtoColumns);
    return mapRow(row);
  } catch (err) {
    if (written.length > 0) await deleteObjects(written);
    rethrowDuplicate(err, 'A skill with this name');
    throw err;
  }
}

export interface SkillPatch {
  name?: string;
  description?: string;
  markdown?: string;
}

export async function updateSkill(
  id: number,
  projectId: number,
  patch: SkillPatch,
): Promise<SkillRow | null> {
  const skill = await getSkillRow(id, projectId);
  if (patch.markdown !== undefined) {
    await putObject(
      skillMdKey(skill.s3Prefix),
      Buffer.from(patch.markdown, 'utf8'),
      'text/markdown',
    );
  }
  const set: Partial<typeof agentSkill.$inferInsert> = {};
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.description !== undefined) set.description = patch.description;
  if (Object.keys(set).length > 0) {
    try {
      await db
        .update(agentSkill)
        .set(set)
        .where(and(eq(agentSkill.id, id), eq(agentSkill.projectId, projectId)));
    } catch (err) {
      rethrowDuplicate(err, 'A skill with this name');
      throw err;
    }
  }
  return getSkill(id, projectId);
}

// Adds a reference file to a skill. Rejects executable files (no scripts in a
// skill). The path is the sanitized file name under refs/.
export async function addReference(
  id: number,
  projectId: number,
  filename: string,
  bytes: Buffer,
  contentType: string,
): Promise<SkillRow | null> {
  const safeName = filename.replace(/[^A-Za-z0-9._-]/g, '_');
  if (!safeName || isDisallowedRef(safeName)) {
    throw new HttpError(400, 'This file type is not allowed as a skill reference');
  }
  const skill = await getSkillRow(id, projectId);
  const path = `refs/${safeName}`;
  const s3Key = `${skill.s3Prefix}/${path}`;
  await putObject(s3Key, bytes, contentType || 'application/octet-stream');

  const files = (skill.files as SkillRef[]).filter((f) => f.path !== path);
  files.push({ path, s3Key, size: bytes.length });
  await db.update(agentSkill).set({ files }).where(eq(agentSkill.id, id));
  return getSkill(id, projectId);
}

// Overwrites the content of an existing reference file, keeping its object key and
// updating its recorded size. 404 if the skill or the reference path is unknown.
export async function updateReference(
  id: number,
  projectId: number,
  path: string,
  bytes: Buffer,
  contentType: string,
): Promise<SkillRow | null> {
  const skill = await getSkillRow(id, projectId);
  const files = skill.files as SkillRef[];
  const ref = files.find((f) => f.path === path);
  if (!ref) throw new HttpError(404, 'Reference file not found');
  await putObject(ref.s3Key, bytes, contentType || 'application/octet-stream');
  const next = files.map((f) => (f.path === path ? { ...f, size: bytes.length } : f));
  await db.update(agentSkill).set({ files: next }).where(eq(agentSkill.id, id));
  return getSkill(id, projectId);
}

export async function deleteReference(
  id: number,
  projectId: number,
  path: string,
): Promise<SkillRow | null> {
  const skill = await getSkillRow(id, projectId);
  const ref = (skill.files as SkillRef[]).find((f) => f.path === path);
  if (!ref) throw new HttpError(404, 'Reference file not found');
  await deleteObjects([ref.s3Key]);
  const files = (skill.files as SkillRef[]).filter((f) => f.path !== path);
  await db.update(agentSkill).set({ files }).where(eq(agentSkill.id, id));
  return getSkill(id, projectId);
}

// Deletes a skill: its object-store contents (SKILL.md + references), then the row.
// The link rows go by ON DELETE CASCADE.
export async function deleteSkill(id: number, projectId: number): Promise<boolean> {
  const rows = await db
    .select()
    .from(agentSkill)
    .where(and(eq(agentSkill.id, id), eq(agentSkill.projectId, projectId)));
  const skill = rows[0];
  if (!skill) return false;
  const keys = [skillMdKey(skill.s3Prefix), ...(skill.files as SkillRef[]).map((f) => f.s3Key)];
  await deleteObjects(keys);
  await db.delete(agentSkill).where(eq(agentSkill.id, id));
  return true;
}

// The skills enabled on an agent, as DTOs. Used by the agent editor and the runtime.
export async function listAgentSkills(agentId: number): Promise<SkillRow[]> {
  const rows = await db
    .select(dtoColumns)
    .from(agentSkillLink)
    .innerJoin(agentSkill, eq(agentSkill.id, agentSkillLink.skillId))
    .where(eq(agentSkillLink.agentId, agentId))
    .orderBy(agentSkill.name);
  return rows.map(mapRow);
}

// Replaces the set of skills enabled on an agent. Only skills in the agent's project
// are accepted; unknown or cross-project ids are ignored. Both the agent and skills
// are validated against projectId by the caller's route guard.
export async function setAgentSkills(
  agentId: number,
  projectId: number,
  skillIds: number[],
): Promise<void> {
  const unique = [...new Set(skillIds)];
  // Keep only ids that are real skills in this project.
  const valid =
    unique.length === 0
      ? []
      : (
          await db
            .select({ id: agentSkill.id })
            .from(agentSkill)
            .where(and(eq(agentSkill.projectId, projectId), inArray(agentSkill.id, unique)))
        ).map((r) => r.id);

  await db.transaction(async (tx) => {
    await tx.delete(agentSkillLink).where(eq(agentSkillLink.agentId, agentId));
    if (valid.length > 0) {
      await tx.insert(agentSkillLink).values(valid.map((skillId) => ({ agentId, skillId })));
    }
  });
}

// True if the agent belongs to the project (guards addressing an agent by id).
export async function agentInProject(agentId: number, projectId: number): Promise<boolean> {
  const rows = await db
    .select({ id: aiAgent.id })
    .from(aiAgent)
    .where(and(eq(aiAgent.id, agentId), eq(aiAgent.projectId, projectId)))
    .limit(1);
  return rows.length > 0;
}
