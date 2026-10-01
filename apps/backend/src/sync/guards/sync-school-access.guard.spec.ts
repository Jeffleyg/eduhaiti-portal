import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { SyncController } from '../sync.controller';
import { SyncSchoolAccessGuard } from './sync-school-access.guard';

function buildContext(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('SyncSchoolAccessGuard', () => {
  const findUnique = jest.fn();
  const prisma = { user: { findUnique } } as unknown as PrismaService;
  const guard = new SyncSchoolAccessGuard(prisma);

  beforeEach(() => findUnique.mockReset());

  it('protects SyncController with JwtAuthGuard and the school guard', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, SyncController) as
      | unknown[]
      | undefined;
    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(SyncSchoolAccessGuard);
  });

  it('rejects requests without an authenticated user', async () => {
    await expect(guard.canActivate(buildContext({}))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects inactive users', async () => {
    findUnique.mockResolvedValue({
      id: 'u1',
      role: 'TEACHER',
      isActive: false,
      schoolId: 's1',
    });
    await expect(
      guard.canActivate(buildContext({ user: { sub: 'u1' } })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects users without a school', async () => {
    findUnique.mockResolvedValue({
      id: 'u1',
      role: 'TEACHER',
      isActive: true,
      schoolId: null,
    });
    await expect(
      guard.canActivate(buildContext({ user: { sub: 'u1' } })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('attaches the school context from the database', async () => {
    findUnique.mockResolvedValue({
      id: 'u1',
      role: 'TEACHER',
      isActive: true,
      schoolId: 's1',
    });
    const request: Record<string, unknown> = { user: { sub: 'u1' } };

    await expect(guard.canActivate(buildContext(request))).resolves.toBe(true);
    expect(request.syncContext).toEqual({
      userId: 'u1',
      role: 'TEACHER',
      schoolId: 's1',
    });
  });
});
