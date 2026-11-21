/**
 * CORS origin policy.
 * - CORS_ORIGIN (comma-separated) wins; FRONTEND_URL is the fallback.
 * - Outside production, any origin is allowed when nothing is configured.
 * - In production an explicit origin is mandatory: the API refuses to start
 *   rather than silently accepting requests from every website.
 */
export function resolveCorsOrigin(
  env: Record<string, string | undefined>,
): string | string[] {
  const raw = env.CORS_ORIGIN?.trim() || env.FRONTEND_URL?.trim() || '';
  const origins = raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    if ((env.NODE_ENV ?? 'development') === 'production') {
      throw new Error(
        'CORS_ORIGIN (or FRONTEND_URL) must be set in production',
      );
    }
    return '*';
  }
  return origins.length === 1 ? origins[0] : origins;
}
