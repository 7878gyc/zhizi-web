import { NextRequest, NextResponse } from 'next/server';
import { proxyZhiziWithCookie } from '@/lib/zhizi-proxy';

// POST /api/auth/fast-login
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const { email, phone, verificationCode } = (body ?? {}) as {
    email?: string;
    phone?: string;
    verificationCode?: string;
  };

  if (!verificationCode || (!email && !phone)) {
    return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
  }

  // 走自己的 BFF，无需伪装浏览器 User-Agent / Referer。
  return proxyZhiziWithCookie(request, '/api/cluster/account/fast-login', {
    method: 'POST',
    auth: false,
    body: email ? { email, verificationCode } : { phone, verificationCode },
  });
}
