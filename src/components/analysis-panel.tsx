'use client';

import type { AnalysisInfo } from '@/lib/go-types';
import { gtpToCoord } from '@/lib/go-types';

interface AnalysisPanelProps {
  analysisData: AnalysisInfo[];
  currentWinrate: number | null;
  currentPlayer: 'black' | 'white';
  isAnalyzing: boolean;
}

// Color rules matching the board: 1st=yellow, 2nd=blue, 3rd=green, 4th-5th or prior<30%=red
const RANK_COLORS = [
  '#E8B931', // yellow - 1st
  '#4A9EFF', // blue - 2nd
  '#4ADE80', // green - 3rd
  '#FF6B6B', // red - 4th
  '#FF6B6B', // red - 5th
];

function getRankColor(idx: number, prior: number): string {
  if (prior < 0.3) return '#FF6B6B'; // red for low prior
  return RANK_COLORS[Math.min(idx, RANK_COLORS.length - 1)];
}

export default function AnalysisPanel({
  analysisData,
  currentWinrate,
  currentPlayer,
  isAnalyzing,
}: AnalysisPanelProps) {
  const blackWinrate = currentWinrate !== null
    ? currentPlayer === 'black' ? currentWinrate : 1 - currentWinrate
    : null;

  const topMoves = analysisData.slice(0, 5);

  return (
    <div className="space-y-4">
      {/* Winrate bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[#4A9EFF] font-medium">黑 {blackWinrate !== null ? `${Math.round(blackWinrate * 100)}%` : '--'}</span>
          <span className="text-[#8B8FA3]">胜率</span>
          <span className="text-[#FF6B6B] font-medium">{blackWinrate !== null ? `${Math.round((1 - blackWinrate) * 100)}%` : '--'} 白</span>
        </div>
        <div className="h-3 bg-[#1A1A2E] rounded-full overflow-hidden relative">
          {blackWinrate !== null && (
            <div
              className="h-full bg-gradient-to-r from-[#4A9EFF] to-[#4A9EFF]/60 transition-all duration-500 ease-out rounded-full"
              style={{ width: `${blackWinrate * 100}%` }}
            />
          )}
          {isAnalyzing && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse" />
          )}
        </div>
      </div>

      {/* Move suggestion table - top 5 with color coding */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[#8B8FA3] text-xs uppercase tracking-wider">选点表</span>
          {isAnalyzing && (
            <span className="flex items-center gap-1 text-amber-400 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              分析中
            </span>
          )}
        </div>

        <div className="space-y-0.5">
          {topMoves.length === 0 ? (
            <div className="text-[#4A4A6A] text-xs text-center py-6">
              连接 AI 后开始分析
            </div>
          ) : (
            <>
              {/* Table header */}
              <div className="flex items-center gap-2 px-2 py-1 text-[10px] text-[#4A4A6A] uppercase tracking-wider border-b border-[#2A3A5C]/50">
                <span className="w-5 text-center">#</span>
                <span className="w-10">坐标</span>
                <span className="w-12 text-right">胜率</span>
                <span className="w-12 text-right">分差</span>
                <span className="w-12 text-right">访问</span>
                <span className="w-10 text-right">先验</span>
              </div>
              {/* Table rows */}
              {topMoves.map((info, idx) => {
                const color = getRankColor(idx, info.prior ?? 0);
                return (
                  <div
                    key={`${info.move}-${idx}`}
                    className="flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors hover:bg-[#1A1A2E]/80"
                  >
                    {/* Rank badge with color */}
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                      style={{
                        backgroundColor: `${color}20`,
                        color,
                        border: `1.5px solid ${color}`,
                      }}
                    >
                      {idx + 1}
                    </span>

                    {/* Move coordinate */}
                    <span className="w-10 font-mono font-semibold text-[#E0E0E0]">
                      {info.move}
                    </span>

                    {/* Winrate */}
                    <span className="w-12 text-right font-mono" style={{ color }}>
                      {(info.winrate * 100).toFixed(1)}%
                    </span>

                    {/* Score */}
                    <span className="w-12 text-right font-mono text-[#8B8FA3]">
                      {info.scoreMean !== undefined
                        ? `${info.scoreMean > 0 ? '+' : ''}${info.scoreMean.toFixed(1)}`
                        : '--'}
                    </span>

                    {/* Visits */}
                    <span className="w-12 text-right font-mono text-[#4A4A6A]">
                      {info.visits > 1000 ? `${(info.visits / 1000).toFixed(1)}k` : info.visits}
                    </span>

                    {/* Prior */}
                    <span className="w-10 text-right font-mono text-[#4A4A6A]">
                      {((info.prior ?? 0) * 100).toFixed(1)}%
                    </span>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* Principal variation */}
      {analysisData.length > 0 && analysisData[0].pv && (
        <div className="space-y-1.5">
          <span className="text-[#8B8FA3] text-xs uppercase tracking-wider">主要变化</span>
          <div className="bg-[#1A1A2E]/50 rounded px-3 py-2">
            <span className="font-mono text-sm text-[#E0E0E0] tracking-wider">
              {analysisData[0].pv.join(' ')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
