import { db } from './db';
import type { AuditActor } from './types';

export async function logAudit(
  invoiceId: string | null,
  actor: AuditActor,
  action: string,
  input: unknown,
  result: unknown,
  reason: string,
): Promise<void> {
  await db()`
    insert into audit_log (invoice_id, actor, action, input, result, reason)
    values (${invoiceId}, ${actor}, ${action},
      ${JSON.stringify(input ?? null)}::jsonb, ${JSON.stringify(result ?? null)}::jsonb, ${reason})`;
}
