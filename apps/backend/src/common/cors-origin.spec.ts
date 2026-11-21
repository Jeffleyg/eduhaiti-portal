import { describe, expect, it } from '@jest/globals';
import { resolveCorsOrigin } from './cors-origin';

describe('resolveCorsOrigin', () => {
  it('allows any origin in development when nothing is configured', () => {
    expect(resolveCorsOrigin({})).toBe('*');
    expect(resolveCorsOrigin({ NODE_ENV: 'test', CORS_ORIGIN: ' ' })).toBe('*');
  });

  it('refuses to start in production without an origin', () => {
    expect(() => resolveCorsOrigin({ NODE_ENV: 'production' })).toThrow(
      'CORS_ORIGIN',
    );
  });

  it('uses CORS_ORIGIN, then FRONTEND_URL, and supports lists', () => {
    expect(resolveCorsOrigin({ CORS_ORIGIN: 'https://a.ht' })).toBe(
      'https://a.ht',
    );
    expect(
      resolveCorsOrigin({
        NODE_ENV: 'production',
        FRONTEND_URL: 'https://f.ht',
      }),
    ).toBe('https://f.ht');
    expect(
      resolveCorsOrigin({ CORS_ORIGIN: 'https://a.ht, https://b.ht,' }),
    ).toEqual(['https://a.ht', 'https://b.ht']);
  });
});
