import { NextRequest, NextResponse } from 'next/server';
import { getAuthToken, proxyZhizi } from '@/lib/zhizi-proxy';

// POST /api/cluster/account/change-password
// 响应不包含新 token，改密成功后前端必须重新登录。
export async function POST(request: NextRequest) {
  if (!getAuthToken(request)) {
    return NextResponse.json({ error: 'Not Authorized' }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  return proxyZhizi(request, '/api/cluster/account/change-password', {
    method: 'POST',
    auth: true,
    body,
  });
}
