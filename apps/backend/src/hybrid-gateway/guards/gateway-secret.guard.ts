import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';

export const GATEWAY_SECRET_HEADER = 'x-gateway-secret';

/**
 * Telecom operators call the SMS/USSD/IVR webhooks server-to-server, so they cannot
 * use a user JWT. They must send the shared secret configured in HYBRID_GATEWAY_SECRET.
 * The caller phone number in the payload is only trustworthy once the operator is
 * authenticated, because the operator is the one that sets it.
 */
@Injectable()
export class GatewaySecretGuard implements CanActivate {
  private readonly logger = new Logger(GatewaySecretGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.HYBRID_GATEWAY_SECRET?.trim();

    if (!expected) {
      if (process.env.NODE_ENV === 'production') {
        this.logger.error('HYBRID_GATEWAY_SECRET is not set; rejecting gateway call');
        throw new UnauthorizedException('Gateway not configured');
      }
      // Local development without an operator: allow, but make it visible.
      this.logger.warn('HYBRID_GATEWAY_SECRET is not set; accepting gateway call (non-production only)');
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const provided = request.headers?.[GATEWAY_SECRET_HEADER];

    if (typeof provided !== 'string' || !secretsMatch(provided, expected)) {
      throw new UnauthorizedException('Invalid gateway secret');
    }

    return true;
  }
}

/** Constant-time comparison; hashing first keeps the buffers the same length. */
function secretsMatch(provided: string, expected: string) {
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}
