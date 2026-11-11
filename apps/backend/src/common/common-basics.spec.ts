import { describe, expect, it, jest } from '@jest/globals';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { httpContext } from '../test-utils/auto-mock';
import { Roles as AuthRoles } from '../auth/decorators/roles.decorator';
import { RolesGuard as AuthRolesGuard } from '../auth/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { Roles, ROLES_KEY } from './decorators/roles.decorator';
import { RolesGuard } from './guards/roles.guard';
import { SyncRequestMiddleware } from '../sync/middleware/sync-request.middleware';
import { ConflictResolverService } from '../sync/services/conflict-resolver.service';
import { PrismaService } from '../prisma/prisma.service';
import * as ownerServices from '../owner/services';

describe('Roles decorators', () => {
  it('store the roles metadata', () => {
    class A {
      @Roles(Role.ADMIN)
      m() {}
      @AuthRoles(Role.TEACHER)
      n() {}
    }
    const r = new Reflector();
    expect(r.get(ROLES_KEY, A.prototype.m)).toEqual([Role.ADMIN]);
    expect(r.get('roles', A.prototype.n)).toEqual([Role.TEACHER]);
  });
});

describe.each([
  ['common RolesGuard', RolesGuard],
  ['auth RolesGuard', AuthRolesGuard],
])('%s', (_name, Guard) => {
  const make = (roles: Role[] | undefined) => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(roles),
    } as unknown as Reflector;
    return new Guard(reflector);
  };

  it('allows when no roles are required', () => {
    expect(make(undefined).canActivate(httpContext({}))).toBe(true);
  });

  it('allows a user with a required role', () => {
    expect(
      make([Role.ADMIN]).canActivate(httpContext({ user: { role: Role.ADMIN } })),
    ).toBe(true);
  });

  it('denies other roles or missing user', () => {
    expect(
      make([Role.ADMIN]).canActivate(httpContext({ user: { role: Role.STUDENT } })),
    ).toBe(false);
    expect(Boolean(make([Role.ADMIN]).canActivate(httpContext({})))).toBe(false);
  });
});

describe('common RolesGuard empty roles', () => {
  it('allows when the role list is empty', () => {
    const guard = new RolesGuard({
      getAllAndOverride: jest.fn().mockReturnValue([]),
    } as unknown as Reflector);
    expect(guard.canActivate(httpContext({}))).toBe(true);
  });
});

describe('JwtAuthGuard', () => {
  it('can be instantiated', () => {
    expect(new JwtAuthGuard()).toBeDefined();
  });
});

describe('JwtStrategy', () => {
  it('reads the secret and returns the payload as user', async () => {
    const config = { getOrThrow: jest.fn().mockReturnValue('secret') };
    const strategy = new JwtStrategy(config as any);
    expect(config.getOrThrow).toHaveBeenCalledWith('JWT_SECRET');
    const payload = { sub: 'u1', email: 'a@b.c', role: 'ADMIN', schoolId: 's1' };
    await expect(strategy.validate(payload)).resolves.toBe(payload);
  });
});

describe('SyncRequestMiddleware', () => {
  it('stamps the received-at header and calls next', () => {
    const req: any = { headers: {} };
    const next = jest.fn();
    new SyncRequestMiddleware().use(req, {} as any, next);
    expect(typeof req.headers['x-sync-received-at']).toBe('string');
    expect(next).toHaveBeenCalled();
  });
});

describe('ConflictResolverService', () => {
  const svc = new ConflictResolverService();

  it('keeps server for invalid client timestamps', () => {
    expect(svc.resolveLastWriteWins(new Date(), 'nope')).toBe('keep-server');
  });

  it('applies client when server has no timestamp', () => {
    expect(svc.resolveLastWriteWins(null, new Date().toISOString())).toBe(
      'apply-client',
    );
  });

  it('applies the newest write', () => {
    const server = new Date('2026-01-02T00:00:00Z');
    expect(svc.resolveLastWriteWins(server, '2026-01-03T00:00:00Z')).toBe(
      'apply-client',
    );
    expect(svc.resolveLastWriteWins(server, '2026-01-02T00:00:00Z')).toBe(
      'apply-client',
    );
    expect(svc.resolveLastWriteWins(server, '2026-01-01T00:00:00Z')).toBe(
      'keep-server',
    );
  });
});

describe('PrismaService lifecycle', () => {
  it('connects and disconnects', async () => {
    const connect = jest.fn<() => Promise<void>>().mockResolvedValue();
    const disconnect = jest.fn<() => Promise<void>>().mockResolvedValue();
    const fake = { $connect: connect, $disconnect: disconnect };
    await PrismaService.prototype.onModuleInit.call(fake);
    await PrismaService.prototype.onModuleDestroy.call(fake);
    expect(connect).toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalled();
  });
});

describe('owner services barrel', () => {
  it('re-exports the owner services', () => {
    expect(Object.keys(ownerServices).sort()).toEqual([
      'AuditService',
      'GlobalSettingsService',
      'MetricsService',
      'PermissionService',
      'TenantService',
    ]);
  });
});
