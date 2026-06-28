import { NextRequest, NextResponse } from 'next/server';

const ZHIZI_API_BASE = 'https://www.zhizigo.com';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, phone, type = 'fast_login' } = body;

    if (!email && !phone) {
      return NextResponse.json(
        { error: 'Missing email or phone' },
        { status: 400 }
      );
    }

    const requestBody = email
      ? { email, type }
      : { phone, type };

    const resp = await fetch(`${ZHIZI_API_BASE}/api/cluster/account/send-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0',
        Referer: 'https://www.zhizigo.com/',
      },
      body: JSON.stringify(requestBody),
    });

    const text = await resp.text();
    let data;
    try {
      data = text ? JSON.parse(text) : { success: true };
    } catch {
      data = { success: resp.ok, message: text || (resp.ok ? '验证码已发送' : '发送失败') };
    }

    if (!resp.ok) {
      return NextResponse.json(data, { status: resp.status });
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
