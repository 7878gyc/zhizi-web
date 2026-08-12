import type { Metadata } from 'next';
import Link from 'next/link';
import { MarkdownContent } from '@/components/markdown-content';
import { humanContent } from './content';

export const metadata: Metadata = {
  title: '隐私与服务说明',
};

export default function PrivacyHumanPage() {
  return (
    <main className="min-h-screen bg-[#0F0F23] text-[#E0E0E0] py-10 md:py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-end mb-3">
          <Link
            href="/privacy/legal"
            className="text-xs text-[#8B8FA3] hover:text-[#E8B931] transition-colors"
          >
            查看正式版
          </Link>
        </div>
        <article className="bg-[#16213E]/60 border border-[#2A3A5C]/40 rounded-2xl p-6 md:p-12">
          <MarkdownContent content={humanContent} />
        </article>
      </div>
    </main>
  );
}
