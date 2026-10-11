import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Zap, Eye, FileText, Cloud, Github } from 'lucide-react';
import { AUTH_COOKIE } from '@/lib/zhizi-auth';

const GITHUB_URL = 'https://github.com/7878gyc/zhizi-web';

export const metadata: Metadata = {
  title: '在线围棋 AI 复盘工具 | 智子围棋 Web',
  description:
    '第三方开源围棋 AI 复盘工具，接入智子官方 KataGo 算力。实时胜率曲线、鹰眼问题手诊断、AI 推荐选点与变化图，支持 SGF 导入导出与云棋谱库。',
  alternates: {
    canonical: '/',
  },
};

const features = [
  {
    Icon: Zap,
    title: '实时 AI 分析',
    description: '落子即算，胜率走势与最佳选点实时更新，变化图预览帮你理解 AI 思路。',
  },
  {
    Icon: Eye,
    title: '鹰眼诊断',
    description: '自动标记疑问、失误、恶手，标注吻合率与首选率，问题手可点击跳转复盘。',
  },
  {
    Icon: FileText,
    title: '棋谱全兼容',
    description: '导入 SGF 文件、解析野狐链接，导出含 AI 分析属性的 SGF，方便保存或分享。',
  },
  {
    Icon: Cloud,
    title: '云棋谱库',
    description: '一键保存到云端，多设备同步，随时查看、下载或删除，数据按用户隔离。',
  },
];

const trustItems = [
  '基于智子官方 KataGo 算力',
  '开源透明 · MIT 协议',
  '云端加密存储',
  '移动端适配',
];

export default async function HomePage() {
  // 服务端读取会话 Cookie，已登录直接进入分析页，避免先闪一下营销页
  const store = await cookies();
  if (store.get(AUTH_COOKIE)) redirect('/analyze');

  return (
    <main className="min-h-screen bg-[#0F0F23] text-[#E0E0E0] font-sans">
      {/* 顶栏 */}
      <header className="sticky top-0 z-40 border-b border-[#2A3A5C]/40 bg-[#0F0F23]/85 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
          <Link href="/" className="font-bold text-[#E8B931] tracking-wide">
            智子围棋 Web
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/about" className="text-[#8B8FA3] hover:text-[#E8B931] transition-colors">
              关于
            </Link>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#8B8FA3] hover:text-[#E8B931] transition-colors flex items-center gap-1"
            >
              <Github className="w-4 h-4" />
              GitHub
            </a>
            <Link
              href="/login"
              className="px-3 py-1.5 rounded-lg bg-[#E8B931] hover:bg-[#F5C84A] text-[#0F0F23] font-medium transition-colors"
            >
              登录
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 pt-14 pb-10 md:pt-20 md:pb-16">
        <div className="mx-auto max-w-6xl grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          <div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight leading-tight">
              用 KataGo 复盘，<br />
              <span className="text-[#E8B931]">每一手都看得懂</span>
            </h1>
            <p className="mt-6 text-base sm:text-lg text-[#8B8FA3] leading-relaxed">
              接入智子官方 KataGo 算力，实时计算胜率、推荐选点与变化图，
              自动标注问题手，支持 9/13/19 路棋盘。
            </p>
            <p className="mt-4 text-sm text-[#4A4A6A]">
              第三方开源客户端，算力与账号由智子官方提供。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/login?mode=register"
                className="inline-flex items-center bg-[#E8B931] hover:bg-[#F5C84A] text-[#0F0F23] font-semibold px-7 py-3 rounded-lg transition-colors"
              >
                免费注册
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center bg-[#2A3A5C]/50 hover:bg-[#2A3A5C] text-[#E0E0E0] font-medium px-7 py-3 rounded-lg transition-colors"
              >
                登录
              </Link>
            </div>
          </div>

          <div className="w-full">
            <Image
              src="/hero-analysis.svg"
              alt="围棋 AI 分析界面：棋盘、胜率曲线与候选选点"
              width={900}
              height={620}
              priority
              className="w-full h-auto rounded-2xl border border-[#2A3A5C]/40"
            />
          </div>
        </div>
      </section>

      {/* 信任条 */}
      <section className="px-6 pb-4">
        <div className="mx-auto max-w-6xl flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-[#8B8FA3]">
          {trustItems.map((item) => (
            <span key={item} className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E8B931]" />
              {item}
            </span>
          ))}
        </div>
      </section>

      {/* 功能亮点 */}
      <section className="px-6 py-14 md:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold">让每一盘对局都有收获</h2>
            <p className="mt-3 text-[#8B8FA3]">从入门到段位，复盘每一步。</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map(({ Icon, title, description }) => (
              <div
                key={title}
                className="bg-[#16213E]/60 border border-[#2A3A5C]/40 rounded-xl p-6 hover:border-[#E8B931]/40 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-[#E8B931]/15 text-[#E8B931] flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="mt-4 font-semibold text-lg text-[#E0E0E0]">{title}</h3>
                <p className="mt-2 text-sm text-[#8B8FA3] leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 计费说明 */}
      <section className="px-6 pb-14 md:pb-20">
        <div className="mx-auto max-w-3xl text-center bg-[#16213E]/60 border border-[#2A3A5C]/40 rounded-2xl px-6 py-10">
          <h2 className="text-xl sm:text-2xl font-bold">按需扣余额 / VIP 共享算力</h2>
          <p className="mt-3 text-sm text-[#8B8FA3] leading-relaxed">
            使用多少扣多少，价格以账户内产品页面为准。注册智子账号即送体验金，先试后付。
          </p>
        </div>
      </section>

      {/* 底部行动号召 */}
      <section className="px-6 pb-16 md:pb-20">
        <div className="mx-auto max-w-3xl bg-[#E8B931]/10 border border-[#E8B931]/25 rounded-2xl px-6 py-12 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#E8B931]">开始你的 AI 复盘</h2>
          <p className="mt-3 text-[#8B8FA3]">接入 KataGo 算力，看清每一步的好坏。</p>
          <div className="mt-7">
            <Link
              href="/login?mode=register"
              className="inline-block bg-[#E8B931] hover:bg-[#F5C84A] text-[#0F0F23] font-semibold px-8 py-3.5 rounded-lg transition-colors"
            >
              免费注册
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#2A3A5C]/40 px-6 py-8 text-center text-xs text-[#4A4A6A]">
        <p className="max-w-3xl mx-auto leading-relaxed">
          智子围棋 Web 是第三方开源客户端，算力与账号由智子官方提供，与智子围棋官方无雇佣或合作关系。
        </p>
        <p className="mt-3">
          <Link href="/about" className="hover:text-[#E8B931] transition-colors">
            关于
          </Link>
          <span className="mx-2 text-[#2A3A5C]">|</span>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#E8B931] transition-colors"
          >
            GitHub
          </a>
          <span className="mx-2 text-[#2A3A5C]">|</span>
          <Link href="/privacy/human" className="hover:text-[#E8B931] transition-colors">
            隐私说明
          </Link>
          <span className="mx-2 text-[#2A3A5C]">|</span>
          <Link href="/privacy/legal" className="hover:text-[#E8B931] transition-colors">
            完整法律条款
          </Link>
        </p>
      </footer>
    </main>
  );
}
