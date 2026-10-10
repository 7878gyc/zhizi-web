import { NextResponse } from 'next/server';
import { ZHIZI_API_BASE, AUTH_COOKIE, getAuthToken, authCookieOptions } from '@/lib/zhizi-auth';

/**
 * 智子围棋 BFF 代理的统一入口。
 *
 * 所有对 zhizigo.com 的调用都通过这里收口，避免在多个 route 里硬编码域名、
 * 重复处理 401 纯文本响应，或散落地拼接鉴权头。
 */

export { ZHIZI_API_BASE, AUTH_COOKIE, getAuthToken, authCookieOptions };

/** 把智子 token 写进 httpOnly Cookie。 */
export function setAuthCookie(response: NextResponse, token: string): void {
  response.cookies.set(AUTH_COOKIE, token, authCookieOptions());
}

/** 清除智子会话 Cookie。 */
export function clearAuthCookie(response: NextResponse): void {
  response.cookies.set(AUTH_COOKIE, '', { ...authCookieOptions(), maxAge: 0 });
}

export interface ZhiziCallOptions {
  method?: string;
  /** 需要转发的 JSON 请求体。GET/DELETE 不传。 */
  body?: unknown;
  /** 是否需要附带鉴权（默认 true）。 */
  auth?: boolean;
  /** 覆盖转发到上游的 query string（默认沿用入参请求的 query）。 */
  query?: URLSearchParams | string;
  /** 额外转发头。 */
  headers?: Record<string, string>;
}

export interface ZhiziResult {
  status: number;
  data: unknown;
  isJson: boolean;
  rawText: string;
}

function normalizeQuery(request: Request, options: ZhiziCallOptions): string {
  if (options.query !== undefined) {
    return options.query.toString();
  }
  return new URL(request.url).searchParams.toString();
}

function buildHeaders(request: Request, options: ZhiziCallOptions): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers ?? {}),
  };
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.auth !== false) {
    const token = getAuthToken(request);
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

/**
 * 调用 zhizigo.com，永不因为 401 纯文本响应而抛错。
 *
 * 官方在 token 无效时返回 HTTP 401 + 纯文本 `Not Authorized`。若直接
 * `resp.json()` 会抛异常被 catch 成 500，这里改为先读 text，能 JSON 再 parse。
 */
export async function callZhizi(
  request: Request,
  path: string,
  options: ZhiziCallOptions = {},
): Promise<ZhiziResult> {
  const method = options.method ?? request.method;
  const query = normalizeQuery(request, options);
  const url = `${ZHIZI_API_BASE}${path}${query ? `?${query}` : ''}`;

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method,
      headers: buildHeaders(request, options),
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: 'no-store',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '上游请求失败';
    return { status: 502, data: { error: message }, isJson: true, rawText: '' };
  }

  const rawText = await upstream.text();
  if (!rawText) {
    return {
      status: upstream.status,
      data: { success: upstream.ok },
      isJson: false,
      rawText,
    };
  }

  try {
    return {
      status: upstream.status,
      data: JSON.parse(rawText),
      isJson: true,
      rawText,
    };
  } catch {
    // 非 JSON（如 401 "Not Authorized"）：包成 error 字段，状态码原样透传。
    return {
      status: upstream.status,
      data: { error: rawText.trim() },
      isJson: false,
      rawText,
    };
  }
}

/** 调用上游并把结果原样（含状态码）转成 NextResponse。 */
export async function proxyZhizi(
  request: Request,
  path: string,
  options: ZhiziCallOptions = {},
): Promise<NextResponse> {
  const result = await callZhizi(request, path, options);
  return NextResponse.json(result.data, { status: result.status });
}

/**
 * 登录/换 token 类接口：调用上游，把返回的 token 写进 httpOnly Cookie，
 * 并从交给前端的响应体里摘掉 token。
 */
export async function proxyZhiziWithCookie(
  request: Request,
  path: string,
  options: ZhiziCallOptions = {},
): Promise<NextResponse> {
  const result = await callZhizi(request, path, options);
  const token = extractToken(result.data);
  const response = NextResponse.json(stripToken(result.data), { status: result.status });
  if (token && result.status >= 200 && result.status < 300) {
    setAuthCookie(response, token);
  }
  return response;
}

/** 从登录类响应体中摘掉 token，绝不把 token 交给前端。 */
export function stripToken<T>(data: T): T {
  if (data && typeof data === 'object') {
    const clone = { ...(data as Record<string, unknown>) };
    delete clone.token;
    return clone as T;
  }
  return data;
}

export function extractToken(data: unknown): string | null {
  if (data && typeof data === 'object') {
    const token = (data as Record<string, unknown>).token;
    if (typeof token === 'string' && token) return token;
  }
  return null;
}
