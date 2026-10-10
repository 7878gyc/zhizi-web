const USER_KEY = 'zhizi_user';

export interface ZhiziUser {
  phone?: string;
  email?: string;
  username?: string;
  nickname?: string;
  [key: string]: unknown;
}

/**
 * 只在浏览器本地缓存非敏感的展示信息（手机号/邮箱/昵称）。
 * 会话 token 由后端写入 httpOnly + Secure + SameSite Cookie，前端永远读不到。
 */
export function saveUser(user: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getUser(): Record<string, unknown> | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearUser(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(USER_KEY);
}

/**
 * 通过同源 BFF 校验当前会话；未登录或 token 失效返回 null。
 * 浏览器会自动携带 httpOnly Cookie，前端无需读取 token。
 */
export async function fetchCurrentUser(): Promise<Record<string, unknown> | null> {
  try {
    const resp = await fetch('/api/auth/me', { cache: 'no-store' });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** 登出：通知后端清除 httpOnly Cookie，并清掉本地展示信息。 */
export async function logout(): Promise<void> {
  clearUser();
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch {
    /* ignore */
  }
}
