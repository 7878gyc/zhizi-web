import type { Metadata } from 'next';
import { Inspector } from 'react-dev-inspector';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: '智子围棋 AI 分析平台',
    template: '%s | 智子围棋 AI',
  },
  description: '基于 GPU 算力的围棋 AI 分析平台，支持 KataGo 多种配置',
  keywords: [
    '围棋',
    'AI',
    'KataGo',
    '棋局分析',
    'GPU算力',
    '智子围棋',
  ],
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.COZE_PROJECT_ENV === 'DEV';

  return (
    <html lang="zh-CN">
      <body className={`antialiased`}>
        {isDev && <Inspector />}
        {children}
      </body>
    </html>
  );
}
