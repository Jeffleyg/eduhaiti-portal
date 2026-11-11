import { UnauthorizedException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { afterEach, describe, expect, it } from '@jest/globals';
import { httpContext } from '../../test-utils/auto-mock';
import { HybridGatewayController } from '../hybrid-gateway.controller';
import { GATEWAY_SECRET_HEADER, GatewaySecretGuard } from './gateway-secret.guard';

const ORIGINAL = { secret: process.env.HYBRID_GATEWAY_SECRET, env: process.env.NODE_ENV };

afterEach(() => {
  process.env.HYBRID_GATEWAY_SECRET = ORIGINAL.secret;
  process.env.NODE_ENV = ORIGINAL.env;
  if (ORIGINAL.secret === undefined) delete process.env.HYBRID_GATEWAY_SECRET;
});

const call = (headers: Record<string, unknown> | undefined) =>
  new GatewaySecretGuard().canActivate(httpContext({ headers } as any));

describe('GatewaySecretGuard', () => {
  it('protects every hybrid webhook', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, HybridGatewayController)).toEqual([GatewaySecretGuard]);
  });

  it('accepts only the configured secret', () => {
    process.env.HYBRID_GATEWAY_SECRET = ' s3cret ';
    expect(call({ [GATEWAY_SECRET_HEADER]: 's3cret' })).toBe(true);
    expect(() => call({ [GATEWAY_SECRET_HEADER]: 'wrong' })).toThrow(UnauthorizedException);
    expect(() => call({ [GATEWAY_SECRET_HEADER]: ['s3cret'] })).toThrow(UnauthorizedException);
    expect(() => call({})).toThrow(UnauthorizedException);
    expect(() => call(undefined)).toThrow(UnauthorizedException);
  });

  it('fails closed in production when no secret is configured', () => {
    delete process.env.HYBRID_GATEWAY_SECRET;
    process.env.NODE_ENV = 'production';
    expect(() => call({})).toThrow(UnauthorizedException);
  });

  it('allows unauthenticated calls outside production when no secret is configured', () => {
    process.env.HYBRID_GATEWAY_SECRET = '   ';
    process.env.NODE_ENV = 'development';
    expect(call({})).toBe(true);
  });
});
