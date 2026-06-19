'use client';

import type { MoveRecord } from '@/lib/go-types';

interface MoveHistoryProps {
  moves: MoveRecord[];
  currentMoveIndex: number;
  onJumpToMove: (index: number) => void;
}

export default function MoveHistory({
  moves,
  currentMoveIndex,
  onJumpToMove,
}: MoveHistoryProps) {
  return (
    <div className="space-y-1.5">
      <span className="text-[#8B8FA3] text-xs uppercase tracking-wider">落子记录</span>
      <div className="bg-[#1A1A2E]/50 rounded-lg p-2 max-h-[200px] overflow-y-auto scrollbar-thin">
        {moves.length === 0 ? (
          <div className="text-[#4A4A6A] text-xs text-center py-3">
            尚无落子
          </div>
        ) : (
          <div className="flex flex-wrap gap-1">
            {moves.map((move, idx) => (
              <button
                key={idx}
                onClick={() => onJumpToMove(idx)}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono transition-colors ${
                  idx === currentMoveIndex
                    ? 'bg-[#E8B931]/20 text-[#E8B931] border border-[#E8B931]/30'
                    : 'text-[#8B8FA3] hover:bg-[#1A1A2E] hover:text-white'
                }`}
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    move.color === 'black' ? 'bg-[#1A1A1A]' : 'bg-[#F0F0F0] border border-gray-400'
                  }`}
                />
                {move.coord}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
