import { createHash } from 'crypto';
import { ZHIZI_API_BASE, getAuthToken } from '@/lib/zhizi-auth';

/**
 * 从请求的 httpOnly Cookie（或兼容旧 Authorization 头）提取 token，
 * 调用 zhizigo.com 验证用户身份并获取手机号/邮箱，
 * 计算 SHA256 哈希作为 userHash。
 *
 * 哈希计算在后端完成，绝不到前端。
 */
export async function extractUserHash(request: Request): Promise<string> {
  const token = getAuthToken(request);
  if (!token) {
    throw new AuthError('Missing authorization token', 401);
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

  // 官方 token 失效时返回 401 + 纯文本 "Not Authorized"；先读 text 再尝试 parse，
  // 避免 resp.json() 抛错被上层 catch 成 500。
  const text = await resp.text();
  let data: { phone?: unknown; email?: unknown };
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new AuthError('认证服务返回异常', 502);
  }

  const identifier = data.phone || data.email;

  if (!identifier || typeof identifier !== 'string') {
    throw new AuthError('无法获取用户标识', 401);
  }

  return createHash('sha256').update(identifier).digest('hex');
}

/**
 * 校验 fileKey 是否位于该用户自己的 R2 目录前缀 `records/{userHash}/` 下。
 *
 * 防止客户端伪造 fileKey 造成越权读/删（IDOR）：即使 DB 记录的 userHash 属于本人，
 * 也要确保 fileKey 指向的是本人目录，否则可引用他人文件。
 */
export function ownsFileKey(userHash: string, fileKey: unknown): boolean {
  return typeof fileKey === 'string' && fileKey.startsWith(`records/${userHash}/`);
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'AuthError';
  }
}
