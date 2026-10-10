import { NextRequest, NextResponse } from 'next/server';
import { getAuthToken, proxyZhizi } from '@/lib/zhizi-proxy';

// GET /api/pay/orders/{orderId}
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params;
  if (!getAuthToken(request)) {
    return NextResponse.json({ error: 'Not Authorized' }, { status: 401 });
  }
  return proxyZhizi(request, `/api/pay/orders/${encodeURIComponent(orderId)}`, {
    auth: true,
  });
}
