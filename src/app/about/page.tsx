import type { Metadata } from 'next';
import { MarkdownContent } from '@/components/markdown-content';
import { aboutContent } from './content';

export const metadata: Metadata = {
  title: '关于',
  description:
    '智子围棋 Web 是第三方开源的围棋 AI 复盘工具，接入智子官方 KataGo 算力。了解项目定位、与智子官方的关系、技术栈与反馈渠道。',
  alternates: {
    canonical: '/about',
  },
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#0F0F23] text-[#E0E0E0] py-10 md:py-16 px-4">
      <article className="max-w-3xl mx-auto bg-[#16213E]/60 border border-[#2A3A5C]/40 rounded-2xl p-6 md:p-12">
        <MarkdownContent content={aboutContent} />
      </article>
    </main>
  );
}
