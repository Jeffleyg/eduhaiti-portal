import { JsonValue } from '@prisma/client/runtime/library';

type LegacyAudit = {
  entityType?: string | null;
  entityId?: string | null;
  resource?: string | null;
  resourceId?: string | null;
  action?: string | null;
  userId?: string | null;
  changes?: any;
  description?: string | null;
};

export function buildAuditData(input: LegacyAudit) {
  const resource = (input.resource ?? input.entityType ?? 'UNKNOWN') as string;
  const resourceId = input.resourceId ?? input.entityId ?? null;
  const action = input.action ?? 'UNKNOWN';

  const out: Record<string, any> = {
    resource,
    action,
  };

  if (resourceId) out.resourceId = resourceId;
  if (input.userId) out.userId = input.userId;
  if (input.description) out.description = input.description;

  // Normalize changes to Json; allow passing string or object
  if (input.changes !== undefined) {
    try {
      // If it's a string, try parse, otherwise use as-is
      if (typeof input.changes === 'string') {
        out.changes = JSON.parse(input.changes);
      } else {
        out.changes = input.changes as JsonValue;
      }
    } catch (e) {
      out.changes = input.changes;
    }
  }

  return out as any;
}

export function safeParseJson<T = any>(value: unknown): T | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch (_) {
      return null;
    }
  }
  // already object-like
  return value as T;
}
