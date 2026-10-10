import { NextRequest, NextResponse } from 'next/server';
import { proxyZhizi } from '@/lib/zhizi-proxy';

// POST /api/auth/send-code
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const { email, phone, type = 'fast_login' } = (body ?? {}) as {
    email?: string;
    phone?: string;
    type?: string;
  };

  if (!email && !phone) {
    return NextResponse.json({ error: '缺少邮箱或手机号' }, { status: 400 });
  }

  // 走自己的 BFF，无需伪装浏览器 User-Agent / Referer。
  return proxyZhizi(request, '/api/cluster/account/send-code', {
    method: 'POST',
    auth: false,
    body: email ? { email, type } : { phone, type },
  });
}
