import { NextRequest, NextResponse } from 'next/server';
import { clearAuthCookie, getAuthToken, proxyZhizi } from '@/lib/zhizi-proxy';

// POST /api/cluster/account/change-password
// 响应不包含新 token，改密成功后必须重新登录：这里顺带清掉会话 Cookie。
export async function POST(request: NextRequest) {
  if (!getAuthToken(request)) {
    return NextResponse.json({ error: 'Not Authorized' }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const response = await proxyZhizi(request, '/api/cluster/account/change-password', {
    method: 'POST',
    auth: true,
    body,
  });
  if (response.status >= 200 && response.status < 300) {
    clearAuthCookie(response);
  }
  return response;
}
