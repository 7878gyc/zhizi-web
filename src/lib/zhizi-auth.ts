/**
 * 智子围棋会话相关的纯工具（不依赖 next/server），
 * 便于服务端逻辑与单元测试共同复用。
 */

export const ZHIZI_API_BASE =
  process.env.ZHIZI_API_BASE ?? 'https://www.zhizigo.com';

/** 浏览器侧保存智子会话 token 的 httpOnly Cookie 名。 */
export const AUTH_COOKIE = 'zhizi_session';

export const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 天

function readCookie(cookieHeader: string, name: string): string | null {
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}

/**
 * 取当前请求的智子 token：优先同源 httpOnly Cookie，其次兼容旧的
 * `Authorization: Bearer <token>` 头（便于灰度与测试）。
 */
export function getAuthToken(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const fromCookie = readCookie(cookieHeader, AUTH_COOKIE);
    if (fromCookie) return fromCookie;
  }
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : authHeader;
  return token.trim() || null;
}

export function authCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  };
}
