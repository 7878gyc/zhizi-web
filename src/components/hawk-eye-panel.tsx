'use client';

import type { HawkEyeMoveResult } from '@/hooks/use-zhizi-analysis';

interface HawkEyePanelProps {
  results: HawkEyeMoveResult[];
  isRunning: boolean;
  progress: { current: number; total: number };
  onStart: () => void;
  onStop: () => void;
  isConnected: boolean;
}

const SEVERITY_LABELS = ['', '疑问手', '失误', '恶手', '大恶手'];
const SEVERITY_COLORS = ['', '#FFD700', '#FF8C00', '#FF4500', '#DC143C'];

export default function HawkEyePanel({
  results,
  isRunning,
  progress,
  onStart,
  onStop,
  isConnected,
}: HawkEyePanelProps) {
  const totalMoves = results.length > 0 ? results.filter(r => r.actualMove).length : 0;
  const analyzedMoves = results.filter(r => r.actualMove && r.winrate != null).length;
  const matchCount = results.filter(r => r.actualMove && r.isMatch).length;
  const bestCount = results.filter(r => r.actualMove && r.isBest).length;
  const matchRate = analyzedMoves > 0 ? (matchCount / analyzedMoves * 100).toFixed(1) : '--';
  const bestRate = analyzedMoves > 0 ? (bestCount / analyzedMoves * 100).toFixed(1) : '--';

  const problemMoves = results.filter(r => r.isProblem);

  const avgDrop = analyzedMoves > 0
    ? results
        .filter(r => r.winrateDrop != null)
        .reduce((sum, r) => sum + Math.abs(r.winrateDrop!), 0) / analyzedMoves * 100
    : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[#8B8FA3] text-xs uppercase tracking-wider">鹰眼分析</span>
        {isRunning ? (
          <button
            onClick={onStop}
            className="px-2 py-0.5 text-xs bg-red-500/20 text-red-400 border border-red-500/30 rounded hover:bg-red-500/30 transition-colors"
          >
            停止
          </button>
        ) : (
          <button
            onClick={onStart}
            disabled={!isConnected || totalMoves === 0}
            className="px-2 py-0.5 text-xs bg-[#E8B931]/20 text-[#E8B931] border border-[#E8B931]/30 rounded hover:bg-[#E8B931]/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            开始分析
          </button>
        )}
      </div>

      {isRunning && (
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-[#4A4A6A]">
            <span>分析中...</span>
            <span>{progress.current}/{progress.total}</span>
          </div>
          <div className="w-full h-1 bg-[#1A1A2E] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#E8B931] rounded-full transition-all duration-300"
              style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {results.length > 0 && !isRunning && (
        <>
          {/* Stats card */}
          <div className="bg-[#1A1A2E]/50 rounded p-2 space-y-1.5">
            <div className="grid grid-cols-2 gap-1 text-xs">
              <div className="text-[#8B8FA3]">吻合率</div>
              <div className="text-right font-mono text-[#4ADE80]">{matchRate}%</div>
              <div className="text-[#8B8FA3]">首选命中</div>
              <div className="text-right font-mono text-[#4A9EFF]">{bestRate}%</div>
              <div className="text-[#8B8FA3]">问题手</div>
              <div className="text-right font-mono text-[#FF6B6B]">{problemMoves.length}</div>
              <div className="text-[#8B8FA3]">平均亏损</div>
              <div className="text-right font-mono text-[#E8B931]">{avgDrop.toFixed(2)}%</div>
            </div>
          </div>

          {/* Move list */}
          <div className="max-h-[300px] overflow-y-auto space-y-0.5 scrollbar-thin">
            {results.map((r, idx) => {
              if (!r.actualMove) return null;
              const moveNum = idx;
              return (
                <div
                  key={idx}
                  className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${
                    r.isProblem ? 'bg-red-500/10 border border-red-500/20' : ''
                  }`}
                >
                  <span className="w-8 font-mono text-[#8B8FA3] text-right shrink-0">
                    {moveNum}
                  </span>
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      r.moveColor === 'black' ? 'bg-white border border-[#4A4A6A]' : 'bg-[#E0E0E0]'
                    }`}
                  />
                  <span className="w-8 font-mono font-semibold shrink-0">
                    {r.actualMove}
                  </span>
                  {r.isMatch ? (
                    <span className="text-[#4ADE80] shrink-0" title={r.isBest ? 'AI首选' : `AI第${r.matchRank}选`}>
                      {r.isBest ? '\u2605' : '\u2713'}
                    </span>
                  ) : (
                    <span className="text-[#FF6B6B] shrink-0">\u2717</span>
                  )}
                  {r.aiBestMove && !r.isMatch && (
                    <span className="text-[#4A4A6A] font-mono text-[10px]">
                      \u2192{r.aiBestMove}
                    </span>
                  )}
                  <span className="flex-1" />
                  {r.winrateDrop != null && (
                    <span
                      className={`font-mono text-[10px] shrink-0 ${
                        r.winrateDrop <= -0.06 ? 'text-[#FF6B6B]' : 'text-[#4A4A6A]'
                      }`}
                    >
                      {(r.winrateDrop * 100).toFixed(1)}%
                    </span>
                  )}
                  {r.isProblem && SEVERITY_LABELS[r.problemSeverity] && (
                    <span
                      className="text-[10px] font-medium shrink-0"
                      style={{ color: SEVERITY_COLORS[r.problemSeverity] }}
                    >
                      {SEVERITY_LABELS[r.problemSeverity]}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
