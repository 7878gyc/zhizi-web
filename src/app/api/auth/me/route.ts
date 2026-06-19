import { NextRequest, NextResponse } from 'next/server';

const ZHIZI_API_BASE = 'https://www.zhizigo.com';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 });
    }
    const resp = await fetch(`${ZHIZI_API_BASE}/api/cluster/account/me`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
    });
    const data = await resp.json();
    return NextResponse.json(data, { status: resp.status });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch user info';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
