'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Trash2, Cloud, Download } from 'lucide-react';

interface CloudRecord {
  id: string;
  fileName: string;
  fileSize: number;
  createdAt: string;
  fileKey: string;
}

interface CloudImportDialogProps {
  open: boolean;
  onClose: () => void;
  records: CloudRecord[];
  loading: boolean;
  error: string;
  importingId: string | null;
  onSelect: (rec: CloudRecord) => void;
  onDelete: (id: string, fileName: string) => void;
}

export function CloudImportDialog({
  open,
  onClose,
  records,
  loading: isLoading,
  error,
  importingId,
  onSelect,
  onDelete,
}: CloudImportDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-[#16213E] rounded-lg p-5 w-[420px] border border-[#2A3A5C] shadow-xl">
        <h3 className="text-sm font-bold text-[#E8B931] mb-3">从云棋谱库导入</h3>

        {error && <p className="text-xs text-[#FF6B6B] mb-3">{error}</p>}

        {isLoading ? (
          <div className="py-10 text-center text-[#8B8FA3] text-sm">加载中...</div>
        ) : records.length === 0 ? (
          <div className="py-10 text-center text-[#8B8FA3] text-sm">
            云端暂无棋谱，可先保存棋谱到云端
          </div>
        ) : (
          <div className="max-h-64 overflow-y-auto -mx-1">
            {records.map((rec) => (
              <div
                key={rec.id}
                onClick={() => {
                  if (!importingId) onSelect(rec);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !importingId) onSelect(rec);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-[#2A3A5C]/50 rounded transition-colors ${
                  importingId ? 'opacity-50 pointer-events-none' : 'cursor-pointer'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#E0E0E0] truncate">{rec.fileName}</p>
                  <p className="text-xs text-[#8B8FA3] mt-0.5">
                    {new Date(rec.createdAt).toLocaleString('zh-CN', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    &nbsp;&middot;&nbsp;
                    {rec.fileSize < 1024
                      ? `${rec.fileSize} B`
                      : rec.fileSize < 1024 * 1024
                        ? `${(rec.fileSize / 1024).toFixed(1)} KB`
                        : `${(rec.fileSize / (1024 * 1024)).toFixed(1)} MB`}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 ml-3 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(rec.id, rec.fileName);
                    }}
                    disabled={importingId !== null}
                    className="p-1 rounded hover:bg-[#FF6B6B]/20 text-[#8B8FA3] hover:text-[#FF6B6B] transition-colors disabled:opacity-30"
                    title="删除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs text-[#E8B931]">
                    {importingId === rec.id ? '导入中...' : '导入'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <button
            onClick={onClose}
            className="flex-1 px-3 py-2 text-sm bg-[#2A3A5C]/50 hover:bg-[#2A3A5C] text-[#8B8FA3] rounded transition-colors"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Save SGF Menu ---

interface SaveSgfMenuProps {
  cloudSourceRecordId: string | null;
  showMenu: boolean;
  cloudSaving: boolean;
  onToggle: () => void;
  onSaveLocal: (includeAnalysis: boolean) => void;
  onSaveCloud: () => void;
  menuRef: React.RefObject<HTMLDivElement | null>;
}

export function SaveSgfMenu({
  cloudSourceRecordId,
  showMenu,
  cloudSaving,
  onToggle,
  onSaveLocal,
  onSaveCloud,
  menuRef,
}: SaveSgfMenuProps) {
  // Close on outside click
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onToggle();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu, menuRef, onToggle]);

  const btnLabel = cloudSourceRecordId
    ? '更新云棋谱'
    : cloudSaving
      ? '保存中...'
      : '保存到云棋谱库';

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs bg-[#1A1A2E] hover:bg-[#2A3A5C] text-[#C8CAD0] border border-[#2A3A5C]/30 rounded transition-colors"
      >
        <Download className="w-3.5 h-3.5" />
        保存 SGF
      </button>
      {showMenu && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#1A1A2E] border border-[#2A3A5C] rounded shadow-lg z-10 overflow-hidden">
          <button
            onClick={() => onSaveLocal(false)}
            className="w-full text-left px-3 py-2 text-xs text-[#C8CAD0] hover:bg-[#2A3A5C] transition-colors"
          >
            纯棋谱文件
          </button>
          <button
            onClick={() => onSaveLocal(true)}
            className="w-full text-left px-3 py-2 text-xs text-[#C8CAD0] hover:bg-[#2A3A5C] transition-colors border-t border-[#2A3A5C]/30"
          >
            带分析的棋谱文件
          </button>
          <button
            onClick={onSaveCloud}
            disabled={cloudSaving}
            className="w-full flex items-center gap-1.5 px-3 py-2 text-xs text-[#E8B931] hover:bg-[#2A3A5C] transition-colors border-t border-[#2A3A5C]/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Cloud className="w-3.5 h-3.5" />
            {btnLabel}
          </button>
        </div>
      )}
    </div>
  );
}
