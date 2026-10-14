import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '登录 / 注册',
  description:
    '登录或注册智子围棋账号，接入官方 KataGo 算力，进行实时胜率、鹰眼诊断与推荐选点的围棋 AI 复盘。',
  alternates: {
    canonical: '/login',
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
