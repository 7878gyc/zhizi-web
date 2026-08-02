'use client';

import { cn } from '@/lib/utils';

interface PlayerBadgesProps {
  blackName: string;
  whiteName: string;
  currentPlayer: 'black' | 'white';
}

export function MobilePlayerBadges({ blackName, whiteName, currentPlayer }: PlayerBadgesProps) {
  return (
    <div className="flex items-center justify-center gap-3 py-1.5 shrink-0">
      {/* Black player */}
      <div
        className={cn(
          'flex items-center gap-1.5 rounded-full px-3 py-1 transition-all duration-200',
          'bg-[#1a1a1a] border',
          currentPlayer === 'black'
            ? 'z-10 scale-105 border-[#666] shadow-md shadow-black/30'
            : 'opacity-60 scale-95 border-[#2a2a2a]'
        )}
      >
        <div className="w-2.5 h-2.5 rounded-full bg-[#1a1a1a] border border-[#555] shrink-0" />
        <span className="text-white text-xs font-medium truncate max-w-[5rem]">
          {blackName || '黑棋'}
        </span>
      </div>

      {/* White player */}
      <div
        className={cn(
          'flex items-center gap-1.5 rounded-full px-3 py-1 transition-all duration-200',
          'bg-[#f5f0e8] border',
          currentPlayer === 'white'
            ? 'z-10 scale-105 border-[#c4b898] shadow-md shadow-black/10'
            : 'opacity-60 scale-95 border-[#d4c9a8]'
        )}
      >
        <div className="w-2.5 h-2.5 rounded-full bg-white border border-[#999] shrink-0" />
        <span className="text-[#1a1a1a] text-xs font-medium truncate max-w-[5rem]">
          {whiteName || '白棋'}
        </span>
      </div>
    </div>
  );
}
