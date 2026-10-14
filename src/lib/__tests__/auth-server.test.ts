import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  extractIdentifier,
  hashIdentifier,
  legacyHashIdentifier,
  AuthError,
  ownsFileKey,
} from '@/lib/auth-server';

function makeRequest(authHeader: string | null): Request {
  const headers = new Headers();
  if (authHeader !== null) headers.set('authorization', authHeader);
  return new Request('http://localhost/api/test', { headers });
}

describe('extractIdentifier', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws 401 when the authorization header is missing', async () => {
    await expect(extractIdentifier(makeRequest(null))).rejects.toMatchObject({
      name: 'AuthError',
      status: 401,
    });
  });

  it('throws 401 when the token is empty', async () => {
    await expect(extractIdentifier(makeRequest('Bearer '))).rejects.toMatchObject({
      status: 401,
    });
  });

  it('extracts the token after "Bearer " prefix', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ phone: '13800000000' }), { status: 200 }),
    );

    await extractIdentifier(makeRequest('Bearer my-secret-token'));

    const [, init] = fetchMock.mock.calls[0];
    expect(init!.headers).toMatchObject({
      Authorization: 'Bearer my-secret-token',
    });
  });

  it('treats a bare header value as the token', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ email: 'a@b.com' }), { status: 200 }),
    );

    await extractIdentifier(makeRequest('bare-token'));

    const [, init] = fetchMock.mock.calls[0];
    expect(init!.headers).toMatchObject({
      Authorization: 'Bearer bare-token',
    });
  });

  it('returns the phone identifier', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ phone: '13800000000' }), { status: 200 }),
    );
    await expect(extractIdentifier(makeRequest('Bearer token'))).resolves.toBe('13800000000');
  });

  it('prefers phone over email', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ phone: '13900000000', email: 'a@b.com' }), { status: 200 }),
    );
    await expect(extractIdentifier(makeRequest('Bearer token'))).resolves.toBe('13900000000');
  });

  it('throws 401 when the account endpoint rejects the token', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 401 }));
    await expect(extractIdentifier(makeRequest('Bearer bad'))).rejects.toMatchObject({
      status: 401,
    });
  });

  it('throws 502 when fetch fails entirely', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));
    await expect(extractIdentifier(makeRequest('Bearer token'))).rejects.toMatchObject({
      status: 502,
    });
  });

  it('throws 401 when the account payload has no phone or email', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 1 }), { status: 200 }),
    );
    await expect(extractIdentifier(makeRequest('Bearer token'))).rejects.toMatchObject({
      status: 401,
    });
  });
});

describe('hashIdentifier', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('falls back to legacy sha256 when no salt is configured', () => {
    vi.stubEnv('USER_HASH_SALT', '');
    expect(hashIdentifier('13800000000')).toBe(legacyHashIdentifier('13800000000'));
    expect(hashIdentifier('13800000000')).toBe(
      '359ea74a80a57accd42a7311ed96eca04f3e631d0ab34ea76808c543240d8a68',
    );
  });

  it('produces a salted HMAC hash that differs from the legacy hash', () => {
    vi.stubEnv('USER_HASH_SALT', 'unit-test-salt');
    const salted = hashIdentifier('13800000000');
    expect(salted).toMatch(/^[0-9a-f]{64}$/);
    expect(salted).not.toBe(legacyHashIdentifier('13800000000'));
  });

  it('is deterministic for the same salt', () => {
    vi.stubEnv('USER_HASH_SALT', 'unit-test-salt');
    expect(hashIdentifier('a@b.com')).toBe(hashIdentifier('a@b.com'));
  });
});

describe('AuthError', () => {
  it('carries a status code and error name', () => {
    const err = new AuthError('boom', 503);
    expect(err.message).toBe('boom');
    expect(err.status).toBe(503);
    expect(err.name).toBe('AuthError');
    expect(err).toBeInstanceOf(Error);
  });
});

describe('ownsFileKey', () => {
  it('accepts a key under the user own directory', () => {
    expect(ownsFileKey('abc', 'records/abc/1.sgf')).toBe(true);
  });

  it('rejects a key under another user directory (IDOR)', () => {
    expect(ownsFileKey('abc', 'records/def/1.sgf')).toBe(false);
  });

  it('rejects prefix lookalikes', () => {
    expect(ownsFileKey('abc', 'records/abcdef/1.sgf')).toBe(false);
    expect(ownsFileKey('abc', 'records/abc')).toBe(false);
  });

  it('rejects non-string keys', () => {
    expect(ownsFileKey('abc', undefined)).toBe(false);
    expect(ownsFileKey('abc', null)).toBe(false);
    expect(ownsFileKey('abc', 123)).toBe(false);
  });
});
