'use client';

import type { AnalysisInfo } from '@/lib/go-types';

interface AnalysisPanelProps {
  analysisData: AnalysisInfo[];
  currentWinrate: number | null;
  currentPlayer: 'black' | 'white';
  isAnalyzing: boolean;
  speed?: number;
  onSelectMove?: (info: AnalysisInfo) => void;
  selectedMove?: string | null;
  hideWinrateBar?: boolean;
  /** Hide section titles (e.g. when rendered inside a tab bar that already labels it). */
  hideTitle?: boolean;
  /** Compact two-column move list (mobile tab). Smaller text, only winrate/score/visits. */
  compact?: boolean;
}

// Color rules: 1st=blue, 2nd=yellow, 3rd+=green (fading), <20% prior or >15% winrate loss=red
function getRankColor(idx: number, prior: number, winrateLoss: number): string {
  if (prior < 0.2 || winrateLoss > 0.15) return '#FF6B6B'; // red
  if (idx === 0) return '#4A9EFF'; // blue - 1st
  if (idx === 1) return '#E8B931'; // yellow - 2nd
  // 3rd+ green with fading opacity
  const greenBase = '#4ADE80';
  const opacity = Math.max(0.3, 1 - (idx - 2) * 0.15);
  return `${greenBase}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`;
}

export default function AnalysisPanel({
  analysisData,
  currentWinrate,
  currentPlayer,
  isAnalyzing,
  speed,
  onSelectMove,
  selectedMove,
  hideWinrateBar,
  hideTitle,
  compact,
}: AnalysisPanelProps) {
  const blackWinrate = currentWinrate !== null
    ? currentPlayer === 'black' ? currentWinrate : 1 - currentWinrate
    : null;

  // Show up to 15 moves
  const topMoves = analysisData.slice(0, 15);
  
  // Calculate best winrate for winrate loss calculation
  const bestWinrate = topMoves.length > 0 ? Math.max(...topMoves.map(m => m.winrate ?? 0)) : 0;

  return (
    <div className="space-y-4">
      {/* Winrate bar */}
      {!hideWinrateBar && (
        <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[#4A9EFF] font-medium">黑 {blackWinrate !== null ? `${Math.round(blackWinrate * 100)}%` : '--'}</span>
          <span className="text-[#8B8FA3]">胜率</span>
          <span className="text-[#FF6B6B] font-medium">{blackWinrate !== null ? `${Math.round((1 - blackWinrate) * 100)}%` : '--'} 白</span>
        </div>
        <div className="h-3 bg-[#1A1A2E] rounded-full overflow-hidden relative">
          {blackWinrate !== null && (
            <div
              className="h-full bg-gradient-to-r from-[#4A9EFF] to-[#4A9EFF]/60 transition-all duration-75 ease-out rounded-full"
              style={{ width: `${blackWinrate * 100}%` }}
            />
          )}
          {isAnalyzing && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse" />
          )}
        </div>
        {speed !== undefined && (
          <div className="text-[10px] text-[#4A4A6A] text-right">
            计算速度: {speed.toFixed(0)} v/s
          </div>
        )}
      </div>
      )}

      {/* Move suggestion table - top 15 with color coding */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          {!hideTitle && (
            <span className="text-[#8B8FA3] text-xs uppercase tracking-wider">选点表</span>
          )}
          {isAnalyzing && (
            <span className="flex items-center gap-1 text-amber-400 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              分析中
            </span>
          )}
        </div>

        <div className={compact ? '' : 'space-y-0.5 max-h-[400px] overflow-y-auto'}>
          {topMoves.length === 0 ? (
            <div className="text-[#4A4A6A] text-xs text-center py-6">
              连接 AI 后开始分析
            </div>
          ) : compact ? (
            /* Compact two-column cards: rank + coord, then winrate/score/visits */
            <div className="grid grid-cols-2 gap-1.5">
              {topMoves.map((info, idx) => {
                const winrateLoss = bestWinrate - (info.winrate ?? 0);
                const color = getRankColor(idx, info.prior ?? 0, winrateLoss);
                return (
                  <div
                    key={`${info.move}-${idx}`}
                    className={`rounded-lg bg-[#1A1A2E]/50 px-2 py-1.5 cursor-pointer transition-colors hover:bg-[#1A1A2E]/80 ${
                      selectedMove === info.move ? 'bg-[#E8B931]/15 ring-1 ring-[#E8B931]/40' : ''
                    }`}
                    onClick={() => onSelectMove?.(info)}
                    title={selectedMove === info.move ? '点击取消预览' : '点击查看变化图'}
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
                        style={{
                          backgroundColor: `${color}20`,
                          color,
                          border: `1.5px solid ${color}`,
                        }}
                      >
                        {idx + 1}
                      </span>
                      <span className="font-mono font-semibold text-[11px] text-[#E0E0E0] leading-none">
                        {info.move}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between font-mono text-[10px] leading-none">
                      <span style={{ color }}>
                        {info.winrate !== undefined ? `${(info.winrate * 100).toFixed(1)}%` : '--'}
                      </span>
                      <span className="text-[#8B8FA3]">
                        {info.scoreLead !== undefined
                          ? `${info.scoreLead > 0 ? '+' : ''}${info.scoreLead.toFixed(1)}`
                          : info.scoreMean !== undefined
                            ? `${info.scoreMean > 0 ? '+' : ''}${info.scoreMean.toFixed(1)}`
                            : '--'}
                      </span>
                      <span className="text-[#4A4A6A]">
                        {info.visits > 1000 ? `${(info.visits / 1000).toFixed(1)}k` : info.visits}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <>
              {/* Table header */}
              <div className="flex items-center gap-2 px-2 py-1 text-[10px] text-[#4A4A6A] uppercase tracking-wider border-b border-[#2A3A5C]/50 sticky top-0 bg-[#16213E]">
                <span className="w-5 text-center">#</span>
                <span className="w-10">坐标</span>
                <span className="w-12 text-right">胜率</span>
                <span className="w-12 text-right">目差</span>
                <span className="w-12 text-right">访问</span>
                <span className="w-10 text-right">先验</span>
              </div>
              {/* Table rows */}
              {topMoves.map((info, idx) => {
                const winrateLoss = bestWinrate - (info.winrate ?? 0);
                const color = getRankColor(idx, info.prior ?? 0, winrateLoss);
                return (
                  <div
                    key={`${info.move}-${idx}`}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors hover:bg-[#1A1A2E]/80 cursor-pointer ${
                      selectedMove === info.move ? 'bg-[#E8B931]/15 ring-1 ring-[#E8B931]/40' : ''
                    }`}
                    onClick={() => onSelectMove?.(info)}
                    title={selectedMove === info.move ? '点击取消预览' : '点击查看变化图'}
                  >
                    {/* Rank badge with color */}
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
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
                      {info.winrate !== undefined ? `${(info.winrate * 100).toFixed(1)}%` : '--'}
                    </span>

                    {/* Score (目差) */}
                    <span className="w-12 text-right font-mono text-[#8B8FA3]">
                      {info.scoreLead !== undefined
                        ? `${info.scoreLead > 0 ? '+' : ''}${info.scoreLead.toFixed(1)}`
                        : info.scoreMean !== undefined
                          ? `${info.scoreMean > 0 ? '+' : ''}${info.scoreMean.toFixed(1)}`
                          : '--'}
                    </span>

                    {/* Visits */}
                    <span className="w-12 text-right font-mono text-[#4A4A6A]">
                      {info.visits > 1000 ? `${(info.visits / 1000).toFixed(1)}k` : info.visits}
                    </span>

                    {/* Prior (先验概率/推荐度) */}
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
      {analysisData.length > 0 && analysisData[0].pv && analysisData[0].pv.length > 0 && (
        <div className="space-y-1.5">
          {!hideTitle && (
            <span className="text-[#8B8FA3] text-xs uppercase tracking-wider">主要变化</span>
          )}
          <div className="bg-[#1A1A2E]/50 rounded px-3 py-2">
            <div className="flex flex-wrap gap-1">
              {analysisData[0].pv!.slice(0, 10).map((move, idx) => (
                <span
                  key={idx}
                  className={`font-mono text-xs px-1.5 py-0.5 rounded ${
                    idx % 2 === 0
                      ? 'bg-[#1A1A1A]/50 text-[#E0E0E0]'
                      : 'bg-[#F0F0F0]/20 text-[#E0E0E0]'
                  }`}
                >
                  {idx + 1}.{move}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
