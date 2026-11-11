import { describe, expect, it } from '@jest/globals';
import { buildAuditData, safeParseJson } from './audit-compat';

describe('buildAuditData', () => {
  it('uses defaults when nothing is provided', () => {
    expect(buildAuditData({})).toEqual({
      resource: 'UNKNOWN',
      entityType: 'UNKNOWN',
      action: 'UNKNOWN',
    });
  });

  it('maps legacy entity fields into both column pairs', () => {
    expect(
      buildAuditData({ entityType: 'User', entityId: 'u1', action: 'CREATE' }),
    ).toEqual({
      resource: 'User',
      resourceId: 'u1',
      entityType: 'User',
      entityId: 'u1',
      action: 'CREATE',
    });
  });

  it('prefers resource fields and copies optional data', () => {
    expect(
      buildAuditData({
        resource: 'School',
        resourceId: 's1',
        entityType: 'SCHOOL_ENTITY',
        entityId: 'ignored',
        action: 'UPDATE',
        userId: 'u1',
        description: 'desc',
        changes: { a: 1 },
      }),
    ).toEqual({
      resource: 'School',
      resourceId: 's1',
      entityType: 'SCHOOL_ENTITY',
      entityId: 's1',
      action: 'UPDATE',
      userId: 'u1',
      description: 'desc',
      changes: { a: 1 },
    });
  });

  it('parses JSON string changes and keeps invalid strings as-is', () => {
    expect(buildAuditData({ changes: '{"x":2}' }).changes).toEqual({ x: 2 });
    expect(buildAuditData({ changes: 'not json' }).changes).toBe('not json');
  });
});

describe('safeParseJson', () => {
  it('handles null, strings, invalid json and objects', () => {
    expect(safeParseJson(null)).toBeNull();
    expect(safeParseJson(undefined)).toBeNull();
    expect(safeParseJson('{"a":1}')).toEqual({ a: 1 });
    expect(safeParseJson('{bad')).toBeNull();
    const obj = { b: 2 };
    expect(safeParseJson(obj)).toBe(obj);
  });
});
