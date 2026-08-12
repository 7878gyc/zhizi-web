import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownContentProps {
  content: string;
}

/**
 * 共享 Markdown 渲染组件：react-markdown + remark-gfm，
 * 样式仅在显式使用本组件的页面生效（不全局启用）。
 */
export function MarkdownContent({ content }: MarkdownContentProps) {
  return (
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
        {content}
      </ReactMarkdown>
    </div>
  );
}
