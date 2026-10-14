import { createHash, createHmac } from 'crypto';
import { ZHIZI_API_BASE, getAuthToken } from '@/lib/zhizi-auth';

/**
 * 从请求的 httpOnly Cookie（或兼容旧 Authorization 头）提取 token，
 * 调用 zhizigo.com /account/me 取回手机号/邮箱标识。
 * 标识不落库、不返回前端，仅在后端用于计算加盐哈希。
 */
export async function extractIdentifier(request: Request): Promise<string> {
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

  return identifier;
}

/**
 * 加盐哈希（HMAC-SHA256(identifier)）。
 * 盐由部署环境的 USER_HASH_SALT 提供，必须稳定持久：一旦变更，已存在的加盐账号
 * 将无法再定位到自己的数据。未配置盐时退回旧的无盐 SHA-256，保证兼容。
 */
export function hashIdentifier(identifier: string): string {
  const salt = process.env.USER_HASH_SALT ?? '';
  if (!salt) return legacyHashIdentifier(identifier);
  return createHmac('sha256', salt).update(identifier).digest('hex');
}

/** 旧的无盐哈希 sha256(identifier)，仅用于老数据兼容判定。 */
export function legacyHashIdentifier(identifier: string): string {
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
