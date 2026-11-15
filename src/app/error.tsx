'use client';

import Link from 'next/link';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen bg-[#0F0F23] text-[#E0E0E0] flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="text-5xl font-bold text-[#FF6B6B]">出错了</div>
        <h1 className="mt-4 text-xl font-semibold">页面暂时无法显示</h1>
        <p className="mt-2 text-sm text-[#8B8FA3]">
          请重试；如果问题持续存在，可以返回首页后重新进入。
        </p>
        {process.env.NODE_ENV !== 'production' && error.message && (
          <pre className="mt-4 max-h-40 overflow-auto rounded-lg bg-[#1A1A2E] p-3 text-left text-xs text-[#FF6B6B]">
            {error.message}
          </pre>
        )}
        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="px-5 py-2.5 rounded-lg bg-[#E8B931] hover:bg-[#F5C84A] text-[#0F0F23] text-sm font-semibold transition-colors"
          >
            重试
          </button>
          <Link
            href="/"
            className="px-5 py-2.5 rounded-lg bg-[#2A3A5C]/60 hover:bg-[#2A3A5C] text-[#E0E0E0] text-sm transition-colors"
          >
            返回首页
          </Link>
        </div>
      </div>
    </main>
  );
}
