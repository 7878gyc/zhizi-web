import { NextResponse } from 'next/server';
import { clearAuthCookie } from '@/lib/zhizi-proxy';

// POST /api/auth/logout
export async function POST() {
  const response = NextResponse.json({ success: true });
  clearAuthCookie(response);
  return response;
}
