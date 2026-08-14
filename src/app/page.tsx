import type { Metadata } from 'next';
import Link from 'next/link';
import { TOKEN_KEY } from '@/lib/auth';

export const metadata: Metadata = {
  title: '智子围棋 · AI 复盘教练 | 在线围棋AI分析平台',
  description:
    '智子围棋 AI 分析平台，基于 KataGo 引擎。新用户注册即送 0.5 元体验金，按需付费（¥1.2/h）或包月（¥30）。实时胜率曲线、鹰眼问题手标注、AI 推荐选点与变化图，支持 SGF 导入导出和云棋谱库，助你快速涨棋。',
  keywords: [
    '智子围棋',
    '围棋AI',
    'KataGo',
    '在线复盘',
    '胜率分析',
    '鹰眼分析',
    '问题手',
    '围棋教学',
    'SGF棋谱',
    '云棋谱库',
    '围棋对局分析',
    'AI围棋',
    '棋力提升',
  ],
  openGraph: {
    title: '智子围棋 · AI 复盘教练 | 在线围棋AI分析平台',
    description:
      '智子围棋 AI 分析平台，基于 KataGo 引擎。新用户注册即送 0.5 元体验金，按需付费（¥1.2/h）或包月（¥30）。实时胜率曲线、鹰眼问题手标注、AI 推荐选点与变化图，支持 SGF 导入导出和云棋谱库，助你快速涨棋。',
    type: 'website',
    url: 'https://zhizi.110708.xyz',
  },
};

/**
 * 功能亮点卡片数据。
 * 说明：所有文案已确认，请严格按照以下文字输出，不要改动内容。
 */
const features = [
  {
    icon: '⚡',
    title: '实时 AI 分析',
    description: '落子即算，胜率走势和最佳选点实时更新，变化图预览帮你理解 AI 思路。',
  },
  {
    icon: '🔍',
    title: '鹰眼诊断',
    description: '自动标记疑问、失误、恶手，标注吻合率与首选率，问题手列表可点击跳转，精准复盘。',
  },
  {
    icon: '📂',
    title: '棋谱全兼容',
    description: '导入 SGF 文件、解析野狐链接，导出含 AI 分析属性的 SGF，方便本地保存或分享。',
  },
  {
    icon: '☁️',
    title: '云棋谱库',
    description: '一键保存到云端，多设备同步，随时查看、下载或删除，数据安全隔离。',
  },
  {
    icon: '📱',
    title: '移动端适配',
    description: '无论手机还是电脑，操作面板自动调整，碎片时间也能高效复盘。',
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 font-sans text-slate-900 dark:text-slate-100">
      {/*
        已登录用户自动跳转到分析页，避免看到营销首页。
        键名直接引用 src/lib/auth.ts 导出的 TOKEN_KEY（zhizi_token），
        与服务端、登录页保持单一来源，修改键名时无需再同步此处。
      */}
      <script
        dangerouslySetInnerHTML={{
          __html: `(function() {
  try {
    if (window.localStorage.getItem('${TOKEN_KEY}')) {
      window.location.replace('/analyze');
    }
  } catch (e) {}
})();`,
        }}
      />

      {/* Hero 区 */}
      <section className="pt-20 pb-14 md:pt-28 md:pb-20 px-6 text-center">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
          智子围棋 · <span className="text-blue-600 dark:text-blue-500">你的 AI 复盘教练</span>
        </h1>
        <p className="mt-6 mx-auto max-w-2xl text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
          接入 KataGo 引擎，实时分析每一步，胜率、问题手、推荐落子一目了然。
          <br />
          支持 9/13/19 路棋盘，从入门到段位，让每一盘对局都有收获。
        </p>
        <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
          按需付费 ¥1.2/小时 · 包月 ¥30 ·{' '}
          <span className="text-blue-600 dark:text-blue-500 font-medium">🎁 新用户送 ¥0.5 体验金</span>
        </p>
        <div className="mt-8">
          <Link
            href="/login"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3.5 rounded-lg shadow-lg shadow-blue-600/25 hover:shadow-xl hover:shadow-blue-600/30 transition-all"
          >
            🎁 注册即送 ¥0.5 体验金
          </Link>
        </div>
      </section>

      {/* 信任标识条 */}
      <section className="px-6 pb-6">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-0 text-xs text-slate-500 dark:text-slate-400">
          <span>✓ 基于智子官方 KataGo 算力</span>
          <span className="hidden sm:inline text-slate-300 dark:text-slate-600 mx-3">|</span>
          <span>✓ 开源透明 · MIT 协议</span>
          <span className="hidden sm:inline text-slate-300 dark:text-slate-600 mx-3">|</span>
          <span>✓ 云端加密存储</span>
        </div>
      </section>

      {/* 功能亮点区 */}
      <section className="px-6 py-14 md:py-20">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold">让每一盘对局都有收获</h2>
          <p className="mt-3 text-slate-600 dark:text-slate-300">从入门到段位，智子围棋陪你每一步。</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <div className="text-3xl">{f.icon}</div>
              <h3 className="mt-3 font-semibold text-lg">{f.title}</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 底部行动号召区 */}
      <section className="px-6 pb-16 md:pb-20">
        <div className="max-w-3xl mx-auto bg-blue-50 dark:bg-blue-950/40 rounded-2xl px-6 py-12 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold">Ready to 涨棋？</h2>
          <p className="mt-3 text-slate-600 dark:text-slate-300">
            立即体验 KataGo 顶级算力，新用户送 ¥0.5 试用
          </p>
          <div className="mt-7">
            <Link
              href="/login"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3.5 rounded-lg shadow-lg shadow-blue-600/25 hover:shadow-xl hover:shadow-blue-600/30 transition-all"
            >
              🎁 领取 0.5 元试用金
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 px-6 py-8 text-center text-xs text-slate-500 dark:text-slate-400">
        <p>© 2026 智子围棋 Web</p>
        <p className="mt-3">
          <Link href="/about" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            关于
          </Link>
          <span className="mx-2 text-slate-300 dark:text-slate-600">|</span>
          <Link href="/privacy/human" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            隐私说明
          </Link>
          <span className="mx-2 text-slate-300 dark:text-slate-600">|</span>
          <Link href="/privacy/legal" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            完整法律条款
          </Link>
        </p>
      </footer>
    </main>
  );
}
