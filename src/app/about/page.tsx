import type { Metadata } from 'next';
import { MarkdownContent } from '@/components/markdown-content';
import { aboutContent } from './content';

export const metadata: Metadata = {
  title: '关于',
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
