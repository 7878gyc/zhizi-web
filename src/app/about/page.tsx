import type { Metadata } from 'next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { aboutContent } from './content';

export const metadata: Metadata = {
  title: '关于',
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#0F0F23] text-[#E0E0E0] py-10 md:py-16 px-4">
      <article className="max-w-3xl mx-auto bg-[#16213E]/60 border border-[#2A3A5C]/40 rounded-2xl p-6 md:p-12">
        <div className="prose prose-invert max-w-none prose-headings:text-[#E8B931] prose-hr:border-[#2A3A5C]/60 prose-li:marker:text-[#4A4A6A]">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ href, children }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#4A9EFF] hover:text-[#6FB2FF] underline underline-offset-2 decoration-[#4A9EFF]/40 break-all"
                >
                  {children}
                </a>
              ),
              code: ({ children }) => (
                <code className="bg-[#1A1A2E] border border-[#2A3A5C]/60 text-[#8BE9FD] px-1.5 py-0.5 rounded text-[0.85em]">
                  {children}
                </code>
              ),
            }}
          >
            {aboutContent}
          </ReactMarkdown>
        </div>
      </article>
    </main>
  );
}
