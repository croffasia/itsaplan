import { crmCustomer, db } from '@repo/db';
import { and, desc, eq } from 'drizzle-orm';
import { iso } from '../shared/lib';

type CrmCustomerSelect = typeof crmCustomer.$inferSelect;

export type CrmCustomerStatus = 'prospect' | 'active' | 'inactive';

export interface CrmCustomerRow {
  id: number;
  publicId: string;
  projectId: number;
  name: string;
  status: CrmCustomerStatus;
  service: string;
  owner: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  projectStatus: string;
  openTasks: string;
  notes: string;
  lastCommunication: string;
  nextAction: string;
  deadline: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CrmCustomerInput {
  name: string;
  status: CrmCustomerStatus;
  service: string;
  owner: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  projectStatus: string;
  openTasks: string;
  notes: string;
  lastCommunication: string;
  nextAction: string;
  deadline: string | null;
}

export type CrmCustomerPatch = Partial<CrmCustomerInput>;

function mapCrmCustomer(row: CrmCustomerSelect): CrmCustomerRow {
  return {
    ...row,
    status: row.status as CrmCustomerStatus,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export async function listCrmCustomers(projectId: number): Promise<CrmCustomerRow[]> {
  const rows = await db
    .select()
    .from(crmCustomer)
    .where(eq(crmCustomer.projectId, projectId))
    .orderBy(desc(crmCustomer.updatedAt), desc(crmCustomer.id));
  return rows.map(mapCrmCustomer);
}

export async function getCrmCustomerByPublicId(publicId: string): Promise<CrmCustomerRow | null> {
  const [row] = await db.select().from(crmCustomer).where(eq(crmCustomer.publicId, publicId));
  return row ? mapCrmCustomer(row) : null;
}

export async function getCrmCustomerProjectId(publicId: string): Promise<number | null> {
  const [row] = await db
    .select({ projectId: crmCustomer.projectId })
    .from(crmCustomer)
    .where(eq(crmCustomer.publicId, publicId));
  return row?.projectId ?? null;
}

export async function createCrmCustomer(
  projectId: number,
  input: CrmCustomerInput,
): Promise<CrmCustomerRow> {
  const [created] = await db
    .insert(crmCustomer)
    .values({ projectId, ...input })
    .returning({ publicId: crmCustomer.publicId });
  const row = await getCrmCustomerByPublicId(created.publicId);
  if (!row) throw new Error('Created CRM customer could not be loaded');
  return row;
}

export async function updateCrmCustomer(
  publicId: string,
  patch: CrmCustomerPatch,
): Promise<CrmCustomerRow | null> {
  const [updated] = await db
    .update(crmCustomer)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(crmCustomer.publicId, publicId))
    .returning({ publicId: crmCustomer.publicId });
  if (!updated) return null;
  return getCrmCustomerByPublicId(updated.publicId);
}

export async function deleteCrmCustomer(publicId: string): Promise<boolean> {
  const [deleted] = await db
    .delete(crmCustomer)
    .where(eq(crmCustomer.publicId, publicId))
    .returning({ id: crmCustomer.id });
  return Boolean(deleted);
}

export async function getCrmCustomerInProject(
  publicId: string,
  projectId: number,
): Promise<CrmCustomerRow | null> {
  const [row] = await db
    .select()
    .from(crmCustomer)
    .where(and(eq(crmCustomer.publicId, publicId), eq(crmCustomer.projectId, projectId)));
  return row ? mapCrmCustomer(row) : null;
}
