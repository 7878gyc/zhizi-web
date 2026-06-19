'use client';

import type { AnalysisInfo } from '@/lib/go-types';
import { gtpToCoord } from '@/lib/go-types';

interface AnalysisPanelProps {
  analysisData: AnalysisInfo[];
  currentWinrate: number | null;
  currentPlayer: 'black' | 'white';
  isAnalyzing: boolean;
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

      {/* Move suggestions */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[#8B8FA3] text-xs uppercase tracking-wider">推荐落子</span>
          {isAnalyzing && (
            <span className="flex items-center gap-1 text-amber-400 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              分析中
            </span>
          )}
        </div>

        <div className="space-y-1 max-h-[320px] overflow-y-auto pr-1 scrollbar-thin">
          {analysisData.length === 0 ? (
            <div className="text-[#4A4A6A] text-xs text-center py-6">
              连接 AI 后开始分析
            </div>
          ) : (
            analysisData.slice(0, 15).map((info, idx) => {
              const isTop = idx === 0;
              return (
                <div
                  key={`${info.move}-${idx}`}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                    isTop
                      ? 'bg-[#E8B931]/10 border border-[#E8B931]/20'
                      : 'bg-[#1A1A2E]/50 hover:bg-[#1A1A2E]'
                  }`}
                >
                  {/* Rank */}
                  <span className={`w-5 text-center font-mono ${isTop ? 'text-[#E8B931]' : 'text-[#4A4A6A]'}`}>
                    {idx + 1}
                  </span>

                  {/* Move coordinate */}
                  <span className={`font-mono font-semibold ${isTop ? 'text-white' : 'text-[#C0C0C0]'}`}>
                    {info.move}
                  </span>

                  {/* Winrate */}
                  <span className={`font-mono ${info.winrate > 0.5 ? 'text-[#4A9EFF]' : 'text-[#FF6B6B]'}`}>
                    {(info.winrate * 100).toFixed(1)}%
                  </span>

                  {/* Score */}
                  {info.scoreMean !== undefined && (
                    <span className="text-[#8B8FA3] font-mono">
                      {info.scoreMean > 0 ? '+' : ''}{info.scoreMean.toFixed(1)}
                    </span>
                  )}

                  {/* Visits */}
                  <span className="ml-auto text-[#4A4A6A] font-mono">
                    {info.visits > 1000 ? `${(info.visits / 1000).toFixed(1)}k` : info.visits}
                  </span>
                </div>
              );
            })
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
