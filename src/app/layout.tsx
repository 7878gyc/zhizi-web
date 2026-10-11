import type { Metadata } from 'next';
import { Inspector } from 'react-dev-inspector';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://zhizi.110708.xyz'),
  title: {
    default: '智子围棋 Web | 在线围棋 AI 复盘工具',
    template: '%s | 智子围棋 Web',
  },
  description:
    '智子围棋 Web 是一个第三方开源围棋 AI 复盘工具，接入智子官方 KataGo 算力，提供实时胜率、鹰眼问题手诊断、AI 推荐选点与变化图，支持 SGF 导入导出与云棋谱库。',
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: 'website',
    siteName: '智子围棋 Web',
    locale: 'zh_CN',
    url: 'https://zhizi.110708.xyz',
    title: '智子围棋 Web | 在线围棋 AI 复盘工具',
    description:
      '第三方开源围棋 AI 复盘工具，接入智子官方 KataGo 算力，实时胜率、鹰眼诊断、推荐选点与变化图。',
  },
  twitter: {
    card: 'summary_large_image',
    title: '智子围棋 Web | 在线围棋 AI 复盘工具',
    description:
      '第三方开源围棋 AI 复盘工具，接入智子官方 KataGo 算力，实时胜率、鹰眼诊断、推荐选点与变化图。',
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
