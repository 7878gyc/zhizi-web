export interface AuthErrorPayload {
  key?: string;
  message?: string;
  error?: string;
}

/**
 * 智子围棋错误 key -> 面向用户的本地文案。
 * 界面只显示本地文案，绝不把原始 key 抛给用户。
 */
export const ZHIZI_ERROR_MESSAGES: Record<string, string> = {
  invalid_password: '密码错误',
  invalid_verification_code: '验证码错误或过期',
  fast_login_too_frequent: '尝试过于频繁，请稍后再试',
  invalid_phone: '手机号格式不正确',
  invalid_email: '邮箱格式不正确',
  invalid_data: '请求参数有误',
  not_found: '账号不存在',
  failed_to_insert_socket_io_token: '获取分析令牌失败，请稍后重试',
  not_authorized: '登录已过期，请重新登录',
};

/**
 * 把上游错误映射成可展示的本地文案。
 * 优先命中的 key 文案，其次服务端已本地化的 message/error，最后用调用方兜底。
 */
export function mapZhiziError(
  data: AuthErrorPayload | null | undefined,
  fallback: string,
): string {
  if (!data) return fallback;
  if (typeof data.key === 'string' && ZHIZI_ERROR_MESSAGES[data.key]) {
    return ZHIZI_ERROR_MESSAGES[data.key];
  }
  // 代理层把 401 纯文本包成 { error: 'Not Authorized' }
  if (data.error === 'Not Authorized' || data.error === 'Not authorized') {
    return ZHIZI_ERROR_MESSAGES.not_authorized;
  }
  return data.message || data.error || fallback;
}
