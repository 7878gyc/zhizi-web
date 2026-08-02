import { NextRequest, NextResponse } from 'next/server';

const ZHIZI_API_BASE = 'https://www.zhizigo.com';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 });
    }
    const body = await request.json();
    const resp = await fetch(`${ZHIZI_API_BASE}/api/cluster/account/fetch-socketio-token`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify(body),
    });
    const text = await resp.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text.slice(0, 200) };
    }
    return NextResponse.json(data, { status: resp.status });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch socket token';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
