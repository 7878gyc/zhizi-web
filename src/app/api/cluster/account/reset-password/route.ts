import { NextRequest } from 'next/server';
import { proxyZhiziWithCookie } from '@/lib/zhizi-proxy';

// POST /api/cluster/account/reset-password
// 成功后官方会返回新的 token，这里直接写入 httpOnly Cookie。
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  return proxyZhiziWithCookie(request, '/api/cluster/account/reset-password', {
    method: 'POST',
    auth: false,
    body,
  });
}
