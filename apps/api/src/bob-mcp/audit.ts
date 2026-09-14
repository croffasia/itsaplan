import { db, mcpAuditLog } from '@repo/db';
import type { AuditEvent } from './security';

export async function writeBobAudit(event: AuditEvent): Promise<void> {
  try {
    await db.insert(mcpAuditLog).values(event);
  } catch {
    console.error('[bob-mcp] audit_write_failed', {
      actor: event.actor,
      requestId: event.requestId,
      toolName: event.toolName,
      resultStatus: event.resultStatus,
      errorCode: event.errorCode ?? 'audit_write_failed',
    });
  }
}
