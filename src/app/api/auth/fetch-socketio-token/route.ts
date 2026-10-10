import { NextRequest, NextResponse } from 'next/server';
import { getAuthToken, proxyZhizi } from '@/lib/zhizi-proxy';

// POST /api/auth/fetch-socketio-token
export async function POST(request: NextRequest) {
  if (!getAuthToken(request)) {
    return NextResponse.json({ error: 'Not Authorized' }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  return proxyZhizi(request, '/api/cluster/account/fetch-socketio-token', {
    method: 'POST',
    auth: true,
    body,
  });
}
