import { crmCustomer, db, projectFile, user } from '@repo/db';
import { desc, eq, getTableColumns } from 'drizzle-orm';
import { iso, num } from '../shared/lib';

type ProjectFileSelect = typeof projectFile.$inferSelect & {
  uploadedByName: string | null;
  crmCustomerPublicId: string | null;
};

export interface ProjectFileRow {
  id: number;
  publicId: string;
  projectId: number;
  uploadedByUserId: string | null;
  uploadedByName: string | null;
  customerId: string | null;
  s3Key: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}

function mapProjectFile(row: ProjectFileSelect): ProjectFileRow {
  return {
    ...row,
    customerId: row.crmCustomerPublicId,
    sizeBytes: num(row.sizeBytes),
    createdAt: iso(row.createdAt),
  };
}

const selection = {
  ...getTableColumns(projectFile),
  uploadedByName: user.name,
  crmCustomerPublicId: crmCustomer.publicId,
};

export async function listProjectFiles(projectId: number): Promise<ProjectFileRow[]> {
  const rows = await db
    .select(selection)
    .from(projectFile)
    .leftJoin(user, eq(user.id, projectFile.uploadedByUserId))
    .leftJoin(crmCustomer, eq(crmCustomer.id, projectFile.crmCustomerId))
    .where(eq(projectFile.projectId, projectId))
    .orderBy(desc(projectFile.createdAt), desc(projectFile.id));
  return rows.map(mapProjectFile);
}

export async function getProjectFileByPublicId(publicId: string): Promise<ProjectFileRow | null> {
  const [row] = await db
    .select(selection)
    .from(projectFile)
    .leftJoin(user, eq(user.id, projectFile.uploadedByUserId))
    .leftJoin(crmCustomer, eq(crmCustomer.id, projectFile.crmCustomerId))
    .where(eq(projectFile.publicId, publicId));
  return row ? mapProjectFile(row) : null;
}

export async function getProjectFileProjectId(publicId: string): Promise<number | null> {
  const [row] = await db
    .select({ projectId: projectFile.projectId })
    .from(projectFile)
    .where(eq(projectFile.publicId, publicId));
  return row?.projectId ?? null;
}

export async function createProjectFile(input: {
  projectId: number;
  crmCustomerId?: number;
  uploadedByUserId: string;
  s3Key: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
}): Promise<ProjectFileRow> {
  const [created] = await db.insert(projectFile).values(input).returning({
    publicId: projectFile.publicId,
  });
  const row = await getProjectFileByPublicId(created.publicId);
  if (!row) throw new Error('Created project file could not be loaded');
  return row;
}

export async function deleteProjectFile(publicId: string): Promise<ProjectFileRow | null> {
  const current = await getProjectFileByPublicId(publicId);
  if (!current) return null;
  await db.delete(projectFile).where(eq(projectFile.publicId, publicId));
  return current;
}
