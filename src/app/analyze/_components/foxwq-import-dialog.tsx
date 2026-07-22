'use client';

import { useState, useCallback } from 'react';

interface FoxwqImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (url: string) => Promise<void>;
}

export default function FoxwqImportDialog({ open, onClose, onImport }: FoxwqImportDialogProps) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleImport = useCallback(async () => {
    if (!url.trim()) {
      setError('请输入野狐围棋棋谱链接');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onImport(url.trim());
      setUrl('');
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '导入失败');
    } finally {
      setLoading(false);
    }
  }, [url, onImport, onClose]);

  const handleClose = useCallback(() => {
    setUrl('');
    setError('');
    onClose();
  }, [onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-[#16213E] rounded-lg p-5 w-[400px] border border-[#2A3A5C] shadow-xl">
        <h3 className="text-sm font-bold text-[#E8B931] mb-3">导入野狐围棋棋谱</h3>
        <p className="text-xs text-[#8B8FA3] mb-3">
          粘贴野狐围棋分享链接，如：https://www.foxwq.com/... 或 https://share.foxwq.com/...
        </p>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="粘贴棋谱链接..."
          className="w-full px-3 py-2 text-sm bg-[#1A1A2E] border border-[#2A3A5C] rounded text-white placeholder-[#4A4A6A] focus:outline-none focus:border-[#E8B931]/50"
        />
        {error && <p className="text-xs text-[#FF6B6B] mt-2">{error}</p>}
        <div className="flex gap-2 mt-4">
          <button
            onClick={handleClose}
            className="flex-1 px-3 py-2 text-sm bg-[#2A3A5C]/50 hover:bg-[#2A3A5C] text-[#8B8FA3] rounded transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleImport}
            disabled={loading}
            className="flex-1 px-3 py-2 text-sm bg-[#E8B931]/20 text-[#E8B931] border border-[#E8B931]/30 hover:bg-[#E8B931]/30 rounded transition-colors disabled:opacity-50"
          >
            {loading ? '导入中...' : '导入'}
          </button>
        </div>
      </div>
    </div>
  );
}
