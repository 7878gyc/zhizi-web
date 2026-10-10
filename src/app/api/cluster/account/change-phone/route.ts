import { NextRequest, NextResponse } from 'next/server';
import { getAuthToken, proxyZhiziWithCookie } from '@/lib/zhizi-proxy';

// POST /api/cluster/account/change-phone  （历史路径，实际可换手机号或邮箱）
// 官方返回带 token 的 Account，需要把新 token 写入 httpOnly Cookie。
export async function POST(request: NextRequest) {
  if (!getAuthToken(request)) {
    return NextResponse.json({ error: 'Not Authorized' }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  return proxyZhiziWithCookie(request, '/api/cluster/account/change-phone', {
    method: 'POST',
    auth: true,
    body,
  });
}
