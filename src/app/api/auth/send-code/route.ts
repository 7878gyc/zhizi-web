import { NextRequest, NextResponse } from 'next/server';
import { proxyZhizi } from '@/lib/zhizi-proxy';

// 官方 send-code 支持的 type 白名单
const ALLOWED_CODE_TYPES = new Set([
  'register',
  'fast_login',
  'reset_password',
  'change_phone',
  'change_email',
]);

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
  if (!ALLOWED_CODE_TYPES.has(type)) {
    return NextResponse.json(
      { error: '验证码类型不合法', key: 'invalid_data' },
      { status: 400 },
    );
  }

  // 走自己的 BFF，无需伪装浏览器 User-Agent / Referer。
  return proxyZhizi(request, '/api/cluster/account/send-code', {
    method: 'POST',
    auth: false,
    body: email ? { email, type } : { phone, type },
  });
}
