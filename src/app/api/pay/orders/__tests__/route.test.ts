import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAuthToken: vi.fn(),
  callZhizi: vi.fn(),
  proxyZhizi: vi.fn(),
}));

vi.mock('@/lib/zhizi-proxy', () => ({
  getAuthToken: mocks.getAuthToken,
  callZhizi: mocks.callZhizi,
  proxyZhizi: mocks.proxyZhizi,
}));

import { POST } from '../route';

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/pay/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAuthToken.mockReturnValue('token');
  mocks.callZhizi.mockResolvedValue({
    status: 200,
    isJson: true,
    rawText: '',
    data: [{ name: 'VIP 1个月', type: 'MEMBERSHIP', price: 1000 }],
  });
  mocks.proxyZhizi.mockResolvedValue({ status: 200 });
});

describe('POST /api/pay/orders', () => {
  it('uses the server-side product price instead of the client amount', async () => {
    const response = await POST(
      makeRequest({
        productName: 'VIP 1个月',
        amount: 1,
        payType: 'WECHAT',
        orderType: 'PURCHASE_PRODUCT',
      }) as never,
    );

    expect(response.status).toBe(200);
    expect(mocks.proxyZhizi).toHaveBeenCalledTimes(1);
    const forwarded = mocks.proxyZhizi.mock.calls[0][2] as { body: { amount: number } };
    expect(forwarded.body.amount).toBe(1000);
  });

  it('rejects unknown products without calling upstream', async () => {
    const response = await POST(
      makeRequest({ productName: '不存在', amount: 1 }) as never,
    );
    expect(response.status).toBe(400);
    expect(mocks.proxyZhizi).not.toHaveBeenCalled();
  });

  it('rejects invalid recharge amounts', async () => {
    const response = await POST(makeRequest({ amount: 0 }) as never);
    expect(response.status).toBe(400);
    expect(mocks.proxyZhizi).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated requests', async () => {
    mocks.getAuthToken.mockReturnValue(null);
    const response = await POST(makeRequest({ amount: 100 }) as never);
    expect(response.status).toBe(401);
    expect(mocks.proxyZhizi).not.toHaveBeenCalled();
  });
});
