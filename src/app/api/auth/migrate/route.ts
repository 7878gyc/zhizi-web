import { NextRequest, NextResponse } from 'next/server';
import { getAuthToken } from '@/lib/zhizi-proxy';
import { AuthError } from '@/lib/auth-server';
import { migrateCurrentUser } from '@/lib/user-key';

// POST /api/auth/migrate
// 老用户登录后主动触发：把旧的无盐哈希数据迁移到加盐哈希路径。
export async function POST(request: NextRequest) {
  if (!getAuthToken(request)) {
    return NextResponse.json({ error: 'Not Authorized' }, { status: 401 });
  }
  try {
    const { migrated } = await migrateCurrentUser(request);
    return NextResponse.json({ migrated });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('User data migrate error:', err);
    return NextResponse.json({ error: '数据迁移失败' }, { status: 500 });
  }
}
