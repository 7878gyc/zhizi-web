import { NextRequest, NextResponse } from 'next/server';

const ZHIZI_API_BASE = 'https://www.zhizigo.com';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const resp = await fetch(`${ZHIZI_API_BASE}/api/cluster/account/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await resp.json();
    return NextResponse.json(data, { status: resp.status });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Login failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
