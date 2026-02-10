import { describe, it, expect } from 'vitest';
import { ensureSupabasePoolerParams, getPostgresConnectionInfo } from '../postgres';

describe('ensureSupabasePoolerParams', () => {
  it('adds pgbouncer and prepare_threshold when missing', () => {
    const input = 'postgresql://user:pass@aws-1-eu-west-1.pooler.supabase.com:6543/db';
    const output = ensureSupabasePoolerParams(input);
    const url = new URL(output);

    expect(url.searchParams.get('pgbouncer')).toBe('true');
    expect(url.searchParams.get('prepare_threshold')).toBe('0');
    expect(url.hostname).toBe('aws-1-eu-west-1.pooler.supabase.com');
    expect(url.port).toBe('6543');
    expect(url.pathname).toBe('/db');
  });

  it('does not override existing params when already present', () => {
    const input =
      'postgresql://user:pass@aws-1-eu-west-1.pooler.supabase.com:6543/db?pgbouncer=true&prepare_threshold=1&sslmode=require';
    const output = ensureSupabasePoolerParams(input);
    const url = new URL(output);

    expect(url.searchParams.get('pgbouncer')).toBe('true');
    expect(url.searchParams.get('prepare_threshold')).toBe('1');
    expect(url.searchParams.get('sslmode')).toBe('require');
  });

  it('returns the original string for invalid URLs', () => {
    const input = 'not-a-url';
    const output = ensureSupabasePoolerParams(input);
    expect(output).toBe(input);
  });

  it('preserves existing query params and fragment', () => {
    const input =
      'postgresql://user:pass@aws-1-eu-west-1.pooler.supabase.com:6543/db?sslmode=require#frag';
    const output = ensureSupabasePoolerParams(input);
    const url = new URL(output);

    expect(url.searchParams.get('sslmode')).toBe('require');
    expect(url.searchParams.get('pgbouncer')).toBe('true');
    expect(url.searchParams.get('prepare_threshold')).toBe('0');
    expect(url.hash).toBe('#frag');
  });

  it('does not corrupt database name after mutation', () => {
    const input = 'postgresql://user:pass@aws-1-eu-west-1.pooler.supabase.com:6543/mydb';
    const output = ensureSupabasePoolerParams(input);
    const info = getPostgresConnectionInfo(output);

    expect(info?.database).toBe('mydb');
  });
});
