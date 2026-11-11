import { Logger } from '@nestjs/common';

const logger = new Logger('Secrets');

/**
 * Returns a secret from configuration. Production refuses to start without it, because a
 * fallback value that lives in the source code protects nothing. Other environments get
 * `devFallback` and a warning so local setups keep working.
 */
export function requireSecret(
  name: string,
  value: string | undefined,
  devFallback: string,
): string {
  const trimmed = value?.trim();
  if (trimmed) {
    return trimmed;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${name} must be set in production`);
  }

  logger.warn(`${name} is not set; using an insecure development key`);
  return devFallback;
}

/** Shows only the last 4 characters of a secret, e.g. "••••abcd". */
export function maskSecret(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  return value.length <= 4 ? '••••' : `••••${value.slice(-4)}`;
}
