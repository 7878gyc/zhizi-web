import { NextRequest, NextResponse } from 'next/server';

const ZHIZI_API_BASE = 'https://www.zhizigo.com';

// GET /api/cluster/product?type=MEMBERSHIP  (no auth required)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.toString();
    const resp = await fetch(
      `${ZHIZI_API_BASE}/api/cluster/product${query ? `?${query}` : ''}`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      },
    );
    const data = await resp.json();
    return NextResponse.json(data, { status: resp.status });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch products';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
