import { NextRequest, NextResponse } from 'next/server';
import { getAuthToken, proxyZhizi } from '@/lib/zhizi-proxy';

// GET /api/cluster/usage/my-usages
export async function GET(request: NextRequest) {
  if (!getAuthToken(request)) {
    return NextResponse.json({ error: 'Not Authorized' }, { status: 401 });
  }
  return proxyZhizi(request, '/api/cluster/usage/my-usages', { auth: true });
}
