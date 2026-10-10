import { NextRequest, NextResponse } from 'next/server';
import { getAuthToken, proxyZhizi } from '@/lib/zhizi-proxy';

// POST /api/pay/orders
// 注意：官方明确创建订单不保证幂等，超时后不得自动重试，控制权交回用户。
export async function POST(request: NextRequest) {
  if (!getAuthToken(request)) {
    return NextResponse.json({ error: 'Not Authorized' }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  return proxyZhizi(request, '/api/pay/orders', {
    method: 'POST',
    auth: true,
    body,
  });
}
