import { NextRequest, NextResponse } from 'next/server';
import { getAuthToken, proxyZhizi } from '@/lib/zhizi-proxy';
import { validateArgsString } from '@/lib/go-types';

// POST /api/auth/fetch-socketio-token
export async function POST(request: NextRequest) {
  if (!getAuthToken(request)) {
    return NextResponse.json({ error: 'Not Authorized' }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const args = (body as { args?: unknown } | null)?.args;
  // 白名单校验引擎参数，避免前端请求被篡改后透传非法配置给上游
  try {
    validateArgsString(args);
  } catch {
    return NextResponse.json(
      { error: '引擎配置不合法', key: 'invalid_data' },
      { status: 400 },
    );
  }
  return proxyZhizi(request, '/api/cluster/account/fetch-socketio-token', {
    method: 'POST',
    auth: true,
    // 只转发白名单字段，避免客户端夹带额外参数影响上游计费/配置。
    body: { args },
  });
}
