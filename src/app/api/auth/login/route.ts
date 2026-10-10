import { NextRequest } from 'next/server';
import { proxyZhiziWithCookie } from '@/lib/zhizi-proxy';

// POST /api/auth/login
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  return proxyZhiziWithCookie(request, '/api/cluster/account/login', {
    method: 'POST',
    auth: false,
    body,
  });
}
