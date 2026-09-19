import { db, projectFile, studioPost, studioTemplate, user } from '@repo/db';
import { aliasedTable, and, desc, eq, getTableColumns } from 'drizzle-orm';
import { iso } from '../shared/lib';

export interface StudioTemplateRow {
  id: number;
  publicId: string;
  projectId: number;
  name: string;
  layout: string;
  aspect: string;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  fontFamily: string;
  stylePrompt: string;
  credentialId: number | null;
  imageModel: string;
  textModel: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudioPostRow {
  id: number;
  publicId: string;
  projectId: number;
  templateId: number;
  templatePublicId: string;
  templateName: string;
  createdByName: string | null;
  title: string;
  topic: string;
  leadLine: string;
  headline: string;
  subtext: string;
  chips: string[];
  ctaLabel: string;
  caption: string;
  imagePrompt: string;
  folder: string;
  sourceImageId: string | null;
  renderedImageId: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

function mapTemplate(row: typeof studioTemplate.$inferSelect): StudioTemplateRow {
  return { ...row, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) };
}

const sourceFile = aliasedTable(projectFile, 'source_file');
const renderedFile = aliasedTable(projectFile, 'rendered_file');

const postSelection = {
  ...getTableColumns(studioPost),
  templatePublicId: studioTemplate.publicId,
  templateName: studioTemplate.name,
  createdByName: user.name,
  sourceImageId: sourceFile.publicId,
  renderedImageId: renderedFile.publicId,
};

type PostSelect = typeof studioPost.$inferSelect & {
  templatePublicId: string;
  templateName: string;
  createdByName: string | null;
  sourceImageId: string | null;
  renderedImageId: string | null;
};

function mapPost(row: PostSelect): StudioPostRow {
  return {
    ...row,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function postQuery() {
  return db
    .select(postSelection)
    .from(studioPost)
    .innerJoin(studioTemplate, eq(studioTemplate.id, studioPost.templateId))
    .leftJoin(user, eq(user.id, studioPost.createdByUserId))
    .leftJoin(sourceFile, eq(sourceFile.id, studioPost.sourceImageFileId))
    .leftJoin(renderedFile, eq(renderedFile.id, studioPost.renderedFileId));
}

export async function listStudioTemplates(projectId: number): Promise<StudioTemplateRow[]> {
  const rows = await db
    .select()
    .from(studioTemplate)
    .where(eq(studioTemplate.projectId, projectId))
    .orderBy(studioTemplate.name);
  return rows.map(mapTemplate);
}

export async function getStudioTemplate(publicId: string): Promise<StudioTemplateRow | null> {
  const [row] = await db.select().from(studioTemplate).where(eq(studioTemplate.publicId, publicId));
  return row ? mapTemplate(row) : null;
}

export async function getStudioTemplateProjectId(publicId: string): Promise<number | null> {
  const [row] = await db
    .select({ projectId: studioTemplate.projectId })
    .from(studioTemplate)
    .where(eq(studioTemplate.publicId, publicId));
  return row?.projectId ?? null;
}

export type StudioTemplateInput = Omit<
  StudioTemplateRow,
  'id' | 'publicId' | 'createdAt' | 'updatedAt'
>;

export async function createStudioTemplate(input: StudioTemplateInput): Promise<StudioTemplateRow> {
  const [created] = await db.insert(studioTemplate).values(input).returning();
  return mapTemplate(created);
}

export async function updateStudioTemplate(
  publicId: string,
  patch: Partial<Omit<StudioTemplateInput, 'projectId'>>,
): Promise<StudioTemplateRow | null> {
  const [row] = await db
    .update(studioTemplate)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(studioTemplate.publicId, publicId))
    .returning();
  return row ? mapTemplate(row) : null;
}

export async function deleteStudioTemplate(publicId: string): Promise<boolean> {
  const rows = await db
    .delete(studioTemplate)
    .where(eq(studioTemplate.publicId, publicId))
    .returning({ id: studioTemplate.id });
  return rows.length > 0;
}

export async function listStudioPosts(projectId: number): Promise<StudioPostRow[]> {
  const rows = await postQuery()
    .where(eq(studioPost.projectId, projectId))
    .orderBy(desc(studioPost.createdAt), desc(studioPost.id));
  return rows.map(mapPost);
}

export async function getStudioPost(publicId: string): Promise<StudioPostRow | null> {
  const [row] = await postQuery().where(eq(studioPost.publicId, publicId));
  return row ? mapPost(row) : null;
}

// The files a post points at, by their numeric id. Replacing a generated asset
// needs these to purge the one that is being superseded.
export async function studioPostFileIds(
  publicId: string,
): Promise<{ source: number | null; rendered: number | null }> {
  const [row] = await db
    .select({ source: studioPost.sourceImageFileId, rendered: studioPost.renderedFileId })
    .from(studioPost)
    .where(eq(studioPost.publicId, publicId));
  return { source: row?.source ?? null, rendered: row?.rendered ?? null };
}

export async function getStudioPostProjectId(publicId: string): Promise<number | null> {
  const [row] = await db
    .select({ projectId: studioPost.projectId })
    .from(studioPost)
    .where(eq(studioPost.publicId, publicId));
  return row?.projectId ?? null;
}

export async function createStudioPost(input: {
  projectId: number;
  templateId: number;
  createdByUserId: string | null;
  title: string;
  topic: string;
  folder: string;
}): Promise<StudioPostRow> {
  const [created] = await db
    .insert(studioPost)
    .values(input)
    .returning({ publicId: studioPost.publicId });
  const row = await getStudioPost(created.publicId);
  if (!row) throw new Error('Created studio post could not be loaded');
  return row;
}

export async function updateStudioPost(
  publicId: string,
  patch: {
    title?: string;
    topic?: string;
    leadLine?: string;
    headline?: string;
    subtext?: string;
    chips?: string[];
    ctaLabel?: string;
    caption?: string;
    imagePrompt?: string;
    status?: string;
    sourceImageFileId?: number | null;
    renderedFileId?: number | null;
  },
): Promise<StudioPostRow | null> {
  await db
    .update(studioPost)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(studioPost.publicId, publicId));
  return getStudioPost(publicId);
}

export async function deleteStudioPost(publicId: string): Promise<StudioPostRow | null> {
  const current = await getStudioPost(publicId);
  if (!current) return null;
  await db.delete(studioPost).where(eq(studioPost.publicId, publicId));
  return current;
}

// The template a post is built on, resolved inside the post's own project so a
// post can never reference another project's design.
export async function getTemplateForPost(
  templatePublicId: string,
  projectId: number,
): Promise<StudioTemplateRow | null> {
  const [row] = await db
    .select()
    .from(studioTemplate)
    .where(
      and(eq(studioTemplate.publicId, templatePublicId), eq(studioTemplate.projectId, projectId)),
    );
  return row ? mapTemplate(row) : null;
}

// A vault folder name not yet used by another post in the project, so each post
// keeps its own folder even when two share a title.
export async function uniqueFolder(projectId: number, base: string): Promise<string> {
  const rows = await db
    .select({ folder: studioPost.folder })
    .from(studioPost)
    .where(eq(studioPost.projectId, projectId));
  const taken = new Set(rows.map((r) => r.folder));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const candidate = `${base} ${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}
