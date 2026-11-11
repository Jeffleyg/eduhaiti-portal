import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { FamilyAuthService } from './family-auth.service';

/** Accepts only family portal tokens and exposes the session as `request.family`. */
@Injectable()
export class FamilySessionGuard implements CanActivate {
  constructor(private readonly familyAuth: FamilyAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const header = request.headers?.authorization;
    const token =
      typeof header === 'string' && header.startsWith('Bearer ')
        ? header.slice(7).trim()
        : '';
    if (!token) {
      throw new UnauthorizedException('Family session required');
    }
    request.family = await this.familyAuth.readSession(token);
    return true;
  }
}
