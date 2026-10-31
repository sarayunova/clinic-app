import type { DB } from './db.js';
import { nowIso } from './time.js';

export interface AuditInput {
  actorId: number | null;
  action: string;
  entity: string;
  entityId?: string | number | null;
  detail?: unknown;
}

/** Writes an audit row. Call inside the same transaction as the change it records. */
export function audit(db: DB, e: AuditInput): void {
  db.prepare('INSERT INTO audit_events(at, actor_id, action, entity, entity_id, detail) VALUES (?,?,?,?,?,?)').run(
    nowIso(),
    e.actorId,
    e.action,
    e.entity,
    e.entityId == null ? null : String(e.entityId),
    e.detail === undefined ? null : JSON.stringify(e.detail),
  );
}

/** Returns {field: {from, to}} for fields whose value actually changed. */
export function diff(before: Record<string, unknown>, after: Record<string, unknown>) {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of Object.keys(after)) {
    if ((before[k] ?? null) !== (after[k] ?? null)) out[k] = { from: before[k] ?? null, to: after[k] ?? null };
  }
  return out;
}
