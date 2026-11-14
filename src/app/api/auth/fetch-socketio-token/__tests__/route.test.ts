import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAuthToken: vi.fn(),
  proxyZhizi: vi.fn(),
}));

vi.mock('@/lib/zhizi-proxy', () => ({
  getAuthToken: mocks.getAuthToken,
  proxyZhizi: mocks.proxyZhizi,
}));

import { POST } from '../route';

const VALID_ARGS =
  '--platform all --engine-type go --gpu-type 1x --kata-name katago-TENSORRT --kata-weight 28bnbt';

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/auth/fetch-socketio-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAuthToken.mockReturnValue('token');
  mocks.proxyZhizi.mockResolvedValue({ status: 200 });
});

describe('POST /api/auth/fetch-socketio-token', () => {
  it('forwards only the validated args field', async () => {
    const response = await POST(
      makeRequest({ args: VALID_ARGS, extra: 'should-not-forward' }) as never,
    );

    expect(response.status).toBe(200);
    const forwarded = mocks.proxyZhizi.mock.calls[0][2] as { body: Record<string, unknown> };
    expect(forwarded.body).toEqual({ args: VALID_ARGS });
  });

  it('rejects non-whitelisted engine args', async () => {
    const response = await POST(
      makeRequest({ args: '--platform all --gpu-type 2x' }) as never,
    );
    expect(response.status).toBe(400);
    expect(mocks.proxyZhizi).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated requests', async () => {
    mocks.getAuthToken.mockReturnValue(null);
    const response = await POST(makeRequest({ args: VALID_ARGS }) as never);
    expect(response.status).toBe(401);
  });
});
