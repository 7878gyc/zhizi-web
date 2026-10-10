import { NextRequest } from 'next/server';
import { proxyZhiziWithCookie } from '@/lib/zhizi-proxy';

// POST /api/cluster/account/register
// 注册前需先调用 /api/auth/send-code（type=register）获取验证码。
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  return proxyZhiziWithCookie(request, '/api/cluster/account/register', {
    method: 'POST',
    auth: false,
    body,
  });
}
