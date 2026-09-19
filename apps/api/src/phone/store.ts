import { crmCustomer, db, phoneCallEvent } from '@repo/db';
import { and, desc, eq, gt, ne } from 'drizzle-orm';
import { iso } from '../shared/lib';

export interface CallEventRow {
  id: number;
  event: string;
  callId: string | null;
  direction: string | null;
  externalNumber: string | null;
  internalNumber: string | null;
  receivedAt: string;
}

export async function recordCallEvent(input: {
  event: string;
  callId: string | null;
  direction: string | null;
  externalNumber: string | null;
  internalNumber: string | null;
  payload: Record<string, unknown>;
}): Promise<void> {
  await db.insert(phoneCallEvent).values(input);
}

// The events the dashboard has not seen yet. `since` is the id of the last one it
// showed, so a reload does not replay old calls.
export async function listCallEvents(since: number, limit = 20): Promise<CallEventRow[]> {
  const rows = await db
    .select({
      id: phoneCallEvent.id,
      event: phoneCallEvent.event,
      callId: phoneCallEvent.callId,
      direction: phoneCallEvent.direction,
      externalNumber: phoneCallEvent.externalNumber,
      internalNumber: phoneCallEvent.internalNumber,
      receivedAt: phoneCallEvent.receivedAt,
    })
    .from(phoneCallEvent)
    .where(gt(phoneCallEvent.id, since))
    .orderBy(desc(phoneCallEvent.id))
    .limit(limit);
  return rows.map((row) => ({ ...row, receivedAt: iso(row.receivedAt) })).reverse();
}

export async function latestCallEventId(): Promise<number> {
  const [row] = await db
    .select({ id: phoneCallEvent.id })
    .from(phoneCallEvent)
    .orderBy(desc(phoneCallEvent.id))
    .limit(1);
  return row?.id ?? 0;
}

export interface PhoneContactMatch {
  customerId: string;
  name: string;
  phone: string;
}

// Only the digits, so "+31 6 3942 9209" and "0639429209" can be compared. The
// country code makes the two differ at the front, which is why the comparison
// below comes down to one ending with the other.
function digits(value: string): string {
  return value.replace(/\D+/g, '');
}

// Enough digits that a shared tail means the same subscriber rather than a
// coincidence. A Dutch subscriber number is 9 digits after the country code.
const MIN_MATCH_DIGITS = 9;

// The CRM customers of a project that carry a phone number, keyed by those digits.
// The caller list matches against this rather than querying per row.
export async function crmPhoneIndex(projectId: number): Promise<PhoneContactMatch[]> {
  const rows = await db
    .select({
      publicId: crmCustomer.publicId,
      name: crmCustomer.name,
      contactPhone: crmCustomer.contactPhone,
    })
    .from(crmCustomer)
    .where(and(eq(crmCustomer.projectId, projectId), ne(crmCustomer.contactPhone, '')));

  return rows
    .filter((row) => digits(row.contactPhone).length >= MIN_MATCH_DIGITS)
    .map((row) => ({
      customerId: row.publicId,
      name: row.name,
      phone: digits(row.contactPhone),
    }));
}

// A caller is the same person as a customer when both numbers end in the same
// subscriber digits: 0639429209 and +31639429209 share their last nine.
export function matchContact(
  number: string | null,
  index: PhoneContactMatch[],
): PhoneContactMatch | null {
  if (!number) return null;
  const called = digits(number);
  if (called.length < MIN_MATCH_DIGITS) return null;
  const tail = called.slice(-MIN_MATCH_DIGITS);
  return index.find((entry) => entry.phone.endsWith(tail)) ?? null;
}
