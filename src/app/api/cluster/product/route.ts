import { NextRequest } from 'next/server';
import { proxyZhizi } from '@/lib/zhizi-proxy';

// GET /api/cluster/product?type=MEMBERSHIP  （无需鉴权）
export async function GET(request: NextRequest) {
  return proxyZhizi(request, '/api/cluster/product', { auth: false });
}
