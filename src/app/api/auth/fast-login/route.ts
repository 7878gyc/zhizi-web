import { NextRequest, NextResponse } from 'next/server';

const ZHIZI_API_BASE = 'https://www.zhizigo.com';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, phone, verificationCode } = body;

    if (!verificationCode || (!email && !phone)) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const requestBody = email
      ? { email, verificationCode }
      : { phone, verificationCode };

    const resp = await fetch(`${ZHIZI_API_BASE}/api/cluster/account/fast-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0',
        Referer: 'https://www.zhizigo.com/',
      },
      body: JSON.stringify(requestBody),
    });

    const data = await resp.json();

    if (!resp.ok) {
      return NextResponse.json(data, { status: resp.status });
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
