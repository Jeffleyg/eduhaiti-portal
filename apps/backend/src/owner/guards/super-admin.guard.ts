import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common'
import { Observable } from 'rxjs'

/**
 * Guard that allows only OWNER (Super Admin) users to access
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest()
    const user = request.user

    if (!user) {
      throw new ForbiddenException('No user found in request')
    }

    if (user.role !== 'OWNER') {
      throw new ForbiddenException(
        `Access denied. Only OWNER role can access this resource. Your role: ${user.role}`
      )
    }

    return true
  }
}

/**
 * Guard that allows OWNER or ADMIN users
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest()
    const user = request.user

    if (!user) {
      throw new ForbiddenException('No user found in request')
    }

    if (user.role !== 'OWNER' && user.role !== 'ADMIN') {
      throw new ForbiddenException(
        `Access denied. Only OWNER or ADMIN roles can access this resource. Your role: ${user.role}`
      )
    }

    return true
  }
}
