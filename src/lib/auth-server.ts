import { createHash } from 'crypto';

const ZHIZI_API_BASE = 'https://www.zhizigo.com';

/**
 * 从 Request 的 Authorization header 提取 token，
 * 调用 zhizigo.com 验证用户身份并获取手机号/邮箱，
 * 计算 SHA256 哈希作为 userHash。
 *
 * 哈希计算在后端完成，绝不到前端。
 */
export async function extractUserHash(request: Request): Promise<string> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    throw new AuthError('Missing authorization header', 401);
  }

  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader;

  if (!token) {
    throw new AuthError('Empty token', 401);
  }

  let resp: Response;
  try {
    resp = await fetch(`${ZHIZI_API_BASE}/api/cluster/account/me`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    throw new AuthError('无法连接认证服务', 502);
  }

  if (!resp.ok) {
    throw new AuthError('Token 无效或已过期', 401);
  }

  const data = await resp.json();
  const identifier = data.phone || data.email;

  if (!identifier || typeof identifier !== 'string') {
    throw new AuthError('无法获取用户标识', 401);
  }

  return createHash('sha256').update(identifier).digest('hex');
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'AuthError';
  }
}
