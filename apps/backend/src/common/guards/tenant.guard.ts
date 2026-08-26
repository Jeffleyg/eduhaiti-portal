import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { user?: any; school?: any }>();

    const user = (req as any).user;
    const headerSchoolId = req.headers['x-school-id'] as string | undefined;
    const schoolId = user?.schoolId || (headerSchoolId && String(headerSchoolId));

    if (!schoolId) {
      throw new UnauthorizedException('Missing school context (schoolId)');
    }

    // attach normalized school object for downstream services
    (req as any).school = { id: schoolId };

    return true;
  }
}
