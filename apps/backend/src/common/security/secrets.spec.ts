import { afterEach, describe, expect, it } from '@jest/globals';
import { maskSecret, requireSecret } from './secrets';

const env = process.env.NODE_ENV;
afterEach(() => {
  process.env.NODE_ENV = env;
});

describe('requireSecret', () => {
  it('returns the trimmed configured value', () => {
    expect(requireSecret('X', '  abc  ', 'dev')).toBe('abc');
  });

  it('uses the development fallback outside production', () => {
    process.env.NODE_ENV = 'development';
    expect(requireSecret('X', '   ', 'dev')).toBe('dev');
    expect(requireSecret('X', undefined, 'dev')).toBe('dev');
  });

  it('refuses to run in production without the secret', () => {
    process.env.NODE_ENV = 'production';
    expect(() => requireSecret('X', undefined, 'dev')).toThrow('X must be set in production');
  });
});

describe('maskSecret', () => {
  it('keeps only the last four characters', () => {
    expect(maskSecret('sk_live_abcd')).toBe('••••abcd');
    expect(maskSecret('abcd')).toBe('••••');
    expect(maskSecret('')).toBeNull();
    expect(maskSecret(null)).toBeNull();
  });
});
