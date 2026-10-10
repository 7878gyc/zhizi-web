'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchCurrentUser } from '@/lib/auth';

/**
 * 已登录用户访问营销首页时自动跳转到分析页。
 * token 存在 httpOnly Cookie 中，前端无法同步读取，改用同源 BFF 校验会话。
 */
export function AuthRedirect() {
  const router = useRouter();

  useEffect(() => {
    let active = true;
    fetchCurrentUser().then((user) => {
      if (active && user) router.replace('/analyze');
    });
    return () => {
      active = false;
    };
  }, [router]);

  return null;
}
