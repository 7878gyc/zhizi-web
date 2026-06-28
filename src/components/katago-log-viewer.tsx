'use client';

import { useState } from 'react';

interface KataGoLogViewerProps {
  logs: string[];
}

export default function KataGoLogViewer({ logs }: KataGoLogViewerProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (logs.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="px-3 py-1.5 bg-[#16213E] border border-[#2A3A5C] rounded-lg text-xs text-[#8B8FA3] hover:text-white transition-colors shadow-lg"
        >
          查看日志 ({logs.length})
        </button>
      ) : (
        <div className="w-96 h-64 bg-[#16213E] border border-[#2A3A5C] rounded-lg shadow-lg flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#2A3A5C]">
            <span className="text-xs text-[#8B8FA3]">KataGo 日志</span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-[#8B8FA3] hover:text-white text-xs"
            >
              关闭
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 font-mono text-[10px] text-[#E0E0E0]">
            {logs.map((log, idx) => (
              <div key={idx} className="py-0.5 border-b border-[#2A3A5C]/30 last:border-0">
                {log}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
