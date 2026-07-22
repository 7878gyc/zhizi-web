'use client';

import { SkipBack, ChevronLeft, Rewind, FastForward, ChevronRight, SkipForward } from 'lucide-react';

interface BoardControlsProps {
  boardSize: number;
  komi: number;
  rules: string;
  canGoPrev: boolean;
  canGoNext: boolean;
  onGoFirst: () => void;
  onGoLast: () => void;
  onGoPrev: () => void;
  onGoNext: () => void;
  onGoBack5: () => void;
  onGoForward5: () => void;
  onSetSize: (size: number) => void;
  onSetKomi: (komi: number) => void;
  onSetRules: (rules: string) => void;
  onReset: () => void;
}

export default function BoardControls({
  boardSize,
  komi,
  rules,
  canGoPrev,
  canGoNext,
  onGoFirst,
  onGoLast,
  onGoPrev,
  onGoNext,
  onGoBack5,
  onGoForward5,
  onSetSize,
  onSetKomi,
  onSetRules,
  onReset,
}: BoardControlsProps) {
  return (
    <>
      {/* Navigation */}
      <div className="flex items-center gap-1.5 mt-3">
        <button
          onClick={onGoFirst}
          disabled={!canGoPrev}
          className="p-1.5 bg-[#16213E] hover:bg-[#2A3A5C] disabled:opacity-30 disabled:hover:bg-[#16213E] text-[#C0C0C0] rounded transition-colors"
          title="第一手"
        >
          <SkipBack className="w-4 h-4" />
        </button>
        <button
          onClick={onGoBack5}
          disabled={!canGoPrev}
          className="p-1.5 bg-[#16213E] hover:bg-[#2A3A5C] disabled:opacity-30 disabled:hover:bg-[#16213E] text-[#C0C0C0] rounded transition-colors"
          title="后退5步"
        >
          <Rewind className="w-4 h-4" />
        </button>
        <button
          onClick={onGoPrev}
          disabled={!canGoPrev}
          className="p-1.5 bg-[#16213E] hover:bg-[#2A3A5C] disabled:opacity-30 disabled:hover:bg-[#16213E] text-[#C0C0C0] rounded transition-colors"
          title="上一步"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={onGoNext}
          disabled={!canGoNext}
          className="p-1.5 bg-[#16213E] hover:bg-[#2A3A5C] disabled:opacity-30 disabled:hover:bg-[#16213E] text-[#C0C0C0] rounded transition-colors"
          title="下一步"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          onClick={onGoForward5}
          disabled={!canGoNext}
          className="p-1.5 bg-[#16213E] hover:bg-[#2A3A5C] disabled:opacity-30 disabled:hover:bg-[#16213E] text-[#C0C0C0] rounded transition-colors"
          title="前进5步"
        >
          <FastForward className="w-4 h-4" />
        </button>
        <button
          onClick={onGoLast}
          disabled={!canGoNext}
          className="p-1.5 bg-[#16213E] hover:bg-[#2A3A5C] disabled:opacity-30 disabled:hover:bg-[#16213E] text-[#C0C0C0] rounded transition-colors"
          title="最后一手"
        >
          <SkipForward className="w-4 h-4" />
        </button>

        <span className="text-[#4A4A6A] text-xs mx-1">|</span>

        {/* Board size */}
        {[9, 13, 19].map((size) => (
          <button
            key={size}
            onClick={() => onSetSize(size)}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              boardSize === size
                ? 'bg-[#E8B931]/20 text-[#E8B931] border border-[#E8B931]/30'
                : 'bg-[#16213E] text-[#8B8FA3] hover:bg-[#2A3A5C]'
            }`}
          >
            {size}路
          </button>
        ))}

        <span className="text-[#4A4A6A] text-xs mx-1">|</span>

        <button
          onClick={onReset}
          className="px-3 py-1.5 text-xs bg-[#16213E] hover:bg-[#FF6B6B]/20 text-[#8B8FA3] hover:text-[#FF6B6B] rounded transition-colors"
        >
          清空
        </button>
      </div>

      {/* Rules & Komi */}
      <div className="flex items-center gap-3 mt-2">
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-[#4A4A6A]">规则</span>
          {(['chinese', 'japanese', 'aga'] as const).map((r) => (
            <button
              key={r}
              onClick={() => onSetRules(r)}
              className={`px-1.5 py-0.5 text-[10px] rounded transition-colors ${
                rules === r
                  ? 'bg-[#E8B931]/15 text-[#E8B931]'
                  : 'text-[#4A4A6A] hover:text-[#8B8FA3]'
              }`}
            >
              {r === 'chinese' ? '中国' : r === 'japanese' ? '日本' : 'AGA'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-[#4A4A6A]">贴目</span>
          {[5.5, 6.5, 7.5].map((k) => (
            <button
              key={k}
              onClick={() => onSetKomi(k)}
              className={`px-1.5 py-0.5 text-[10px] rounded transition-colors ${
                komi === k
                  ? 'bg-[#E8B931]/15 text-[#E8B931]'
                  : 'text-[#4A4A6A] hover:text-[#8B8FA3]'
              }`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
