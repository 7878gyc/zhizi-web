import { NextRequest, NextResponse } from 'next/server';
import { getAuthToken, proxyZhizi } from '@/lib/zhizi-proxy';

// PUT /api/cluster/account/me  （仅支持更新 membershipAutoRenew）
export async function PUT(request: NextRequest) {
  if (!getAuthToken(request)) {
    return NextResponse.json({ error: 'Not Authorized' }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  return proxyZhizi(request, '/api/cluster/account/me', {
    method: 'PUT',
    auth: true,
    body,
  });
}
