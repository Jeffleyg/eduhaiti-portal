import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface SyncContext {
  userId: string;
  role: Role;
  schoolId: string;
}

export interface SyncAuthenticatedRequest {
  user?: { sub?: string };
  syncContext: SyncContext;
}

/**
 * Re-checks the JWT user against the database on every sync call: the account
 * must still be active and linked to a school. The school comes from the DB,
 * never from the client, so all sync queries are scoped to it.
 */
@Injectable()
export class SyncSchoolAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<SyncAuthenticatedRequest>();
    const userId = request.user?.sub;

    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, isActive: true, schoolId: true },
    });

    if (!user || !user.isActive) {
      throw new ForbiddenException('User account is inactive');
    }

    if (!user.schoolId) {
      throw new ForbiddenException('User is not linked to a school');
    }

    request.syncContext = {
      userId: user.id,
      role: user.role,
      schoolId: user.schoolId,
    };

    return true;
  }
}
