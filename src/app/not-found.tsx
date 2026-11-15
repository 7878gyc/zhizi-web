import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#0F0F23] text-[#E0E0E0] flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="text-7xl font-bold text-[#E8B931] tracking-tight">404</div>
        <h1 className="mt-4 text-xl font-semibold">页面不存在</h1>
        <p className="mt-2 text-sm text-[#8B8FA3]">
          你访问的页面可能已被删除，或者链接地址有误。
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/"
            className="px-5 py-2.5 rounded-lg bg-[#E8B931] hover:bg-[#F5C84A] text-[#0F0F23] text-sm font-semibold transition-colors"
          >
            返回首页
          </Link>
          <Link
            href="/analyze"
            className="px-5 py-2.5 rounded-lg bg-[#2A3A5C]/60 hover:bg-[#2A3A5C] text-[#E0E0E0] text-sm transition-colors"
          >
            进入分析
          </Link>
        </div>
      </div>
    </main>
  );
}
