import { describe, it, expect, vi, afterEach } from 'vitest';
import { extractUserHash, AuthError } from '@/lib/auth-server';

function makeRequest(authHeader: string | null): Request {
  const headers = new Headers();
  if (authHeader !== null) headers.set('authorization', authHeader);
  return new Request('http://localhost/api/test', { headers });
}

describe('extractUserHash', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws 401 when the authorization header is missing', async () => {
    await expect(extractUserHash(makeRequest(null))).rejects.toMatchObject({
      name: 'AuthError',
      status: 401,
    });
  });

  it('throws 401 when the token is empty', async () => {
    await expect(extractUserHash(makeRequest('Bearer '))).rejects.toMatchObject({
      status: 401,
    });
  });

  it('extracts the token after "Bearer " prefix', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ phone: '13800000000' }), { status: 200 })
    );

    await extractUserHash(makeRequest('Bearer my-secret-token'));

    const [, init] = fetchMock.mock.calls[0];
    expect(init!.headers).toMatchObject({
      Authorization: 'Bearer my-secret-token',
    });
  });

  it('treats a bare header value as the token', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ email: 'a@b.com' }), { status: 200 })
    );

    await extractUserHash(makeRequest('bare-token'));

    const [, init] = fetchMock.mock.calls[0];
    expect(init!.headers).toMatchObject({
      Authorization: 'Bearer bare-token',
    });
  });

  it('hashes the phone identifier with SHA-256', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ phone: '13800000000' }), { status: 200 })
    );

    const hash = await extractUserHash(makeRequest('Bearer token'));
    // sha256("13800000000") hex
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe('359ea74a80a57accd42a7311ed96eca04f3e631d0ab34ea76808c543240d8a68');
  });

  it('prefers phone over email', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ phone: '13900000000', email: 'a@b.com' }), { status: 200 })
    );
    const hash = await extractUserHash(makeRequest('Bearer token'));
    expect(fetchMock).toHaveBeenCalled();
    expect(hash).toBe('76b3bc961ab030f63500d07b0904b200b28c01e47bc8e59e979885634dfa0a4c');
  });

  it('throws 401 when the account endpoint rejects the token', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 401 }));
    await expect(extractUserHash(makeRequest('Bearer bad'))).rejects.toMatchObject({
      status: 401,
    });
  });

  it('throws 502 when fetch fails entirely', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));
    await expect(extractUserHash(makeRequest('Bearer token'))).rejects.toMatchObject({
      status: 502,
    });
  });

  it('throws 401 when the account payload has no phone or email', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 1 }), { status: 200 })
    );
    await expect(extractUserHash(makeRequest('Bearer token'))).rejects.toMatchObject({
      status: 401,
    });
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
