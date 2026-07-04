'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { AnalysisInfo } from '@/lib/go-types';

interface HawkEyeRecord {
  candidates: AnalysisInfo[];
  winrate: number;       // raw winrate from engine (current-player perspective)
}

export interface HawkEyeMoveResult {
  moveNumber: number;
  moveColor: string | null;
  actualMove: string | null;
  winrate: number | null;       // Black-perspective winrate at this position
  aiBestMove: string | null;
  aiMatches: string[];
  isMatch: boolean;
  isBest: boolean;
  matchRank: number | null;
  scoreMean: number | null;
  winrateDrop: number | null;
  isProblem: boolean;
  problemSeverity: number;
}

interface HawkEyePanelProps {
  analysisData: AnalysisInfo[];
  currentWinrate: number | null;
  gtpMoves: string[];
  currentPlayer: 'black' | 'white';
}

const SEVERITY_LABELS = ['', '疑问手', '失误', '恶手', '大恶手'];
const SEVERITY_COLORS = ['', '#FFD700', '#FF8C00', '#FF4500', '#DC143C'];
const PROBLEM_THRESHOLDS = [0, -0.03, -0.06, -0.12, -0.24];

export default function HawkEyePanel({
  analysisData,
  currentWinrate,
  gtpMoves,
  currentPlayer,
}: HawkEyePanelProps) {
  const historyRef = useRef<Map<number, HawkEyeRecord>>(new Map());
  const [version, setVersion] = useState(0);

  // Record analysis data whenever it arrives for the current position
  useEffect(() => {
    if (analysisData.length > 0) {
      const posIdx = gtpMoves.length;
      const record: HawkEyeRecord = {
        candidates: analysisData,
        winrate: currentWinrate ?? 0,
      };
      const prev = historyRef.current.get(posIdx);
      // Only update if this entry has more visits (engine is still computing)
      if (!prev || (prev.candidates[0]?.visits ?? 0) < (analysisData[0]?.visits ?? 0)) {
        historyRef.current.set(posIdx, record);
        setVersion(v => v + 1);
      }
    }
  }, [analysisData, currentWinrate, gtpMoves.length]);

  // Compute per-move results from the accumulated history + game state
  const results = useMemo<HawkEyeMoveResult[]>(() => {
    const totalPositions = gtpMoves.length + 1;
    const res: HawkEyeMoveResult[] = [];

    for (let k = 0; k < totalPositions; k++) {
      const record = historyRef.current.get(k);
      const moveColor = k > 0 ? (k % 2 === 1 ? 'black' : 'white') : null;
      const actualMove = k < gtpMoves.length ? gtpMoves[k].split(' ')[1] : null;

      if (!record) {
        // Not analyzed yet
        res.push({
          moveNumber: k, moveColor, actualMove,
          winrate: null, aiBestMove: null, aiMatches: [], isMatch: false, isBest: false,
          matchRank: null, scoreMean: null, winrateDrop: null, isProblem: false, problemSeverity: 0,
        });
        continue;
      }

      // Convert engine winrate to Black's perspective
      const rawWR = record.winrate;
      const blackWR = rawWR != null
        ? (k % 2 === 0 ? rawWR : 1 - rawWR)
        : null;

      const sorted = [...record.candidates].sort((a, b) => (a.order || 0) - (b.order || 0));

      let isMatch = false;
      let isBest = false;
      let matchRank: number | null = null;
      if (actualMove) {
        const matchIdx = sorted.findIndex(c => c.move === actualMove);
        if (matchIdx >= 0 && matchIdx < 5) {
          isMatch = true;
          isBest = matchIdx === 0;
          matchRank = matchIdx + 1;
        }
      }

      res.push({
        moveNumber: k,
        moveColor,
        actualMove,
        winrate: blackWR,
        aiBestMove: sorted[0]?.move ?? null,
        aiMatches: sorted.slice(0, 5).map(c => c.move),
        isMatch, isBest, matchRank,
        scoreMean: sorted[0]?.scoreMean ?? sorted[0]?.scoreLead ?? null,
        winrateDrop: null,  // computed below
        isProblem: false,
        problemSeverity: 0,
      });
    }

    // Compute winrate drops
    for (let i = 1; i < res.length; i++) {
      const prev = res[i - 1];
      const curr = res[i];
      if (prev.winrate != null && curr.winrate != null) {
        const drop = curr.winrate - prev.winrate;
        curr.winrateDrop = curr.moveColor === 'black'
          ? drop
          : -drop;
      }
    }

    // Tag problem moves
    for (let i = 1; i < res.length; i++) {
      const drop = res[i].winrateDrop;
      if (drop != null) {
        for (let s = PROBLEM_THRESHOLDS.length - 1; s >= 0; s--) {
          if (drop <= PROBLEM_THRESHOLDS[s]) {
            res[i].isProblem = s > 0;
            res[i].problemSeverity = s;
            break;
          }
        }
      }
    }

    return res;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, gtpMoves]);

  const analyzedMoves = results.filter(r => r.actualMove && r.winrate != null).length;
  const matchCount = results.filter(r => r.actualMove && r.isMatch).length;
  const bestCount = results.filter(r => r.actualMove && r.isBest).length;
  const matchRate = analyzedMoves > 0 ? (matchCount / analyzedMoves * 100).toFixed(1) : '--';
  const bestRate = analyzedMoves > 0 ? (bestCount / analyzedMoves * 100).toFixed(1) : '--';
  const problemMoves = results.filter(r => r.isProblem);
  const totalMoves = results.filter(r => r.actualMove).length;
  const avgDrop = analyzedMoves > 0
    ? results
        .filter(r => r.winrateDrop != null)
        .reduce((sum, r) => sum + Math.abs(r.winrateDrop!), 0) / analyzedMoves * 100
    : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[#8B8FA3] text-xs uppercase tracking-wider">鹰眼分析</span>
        <span className="text-[10px] text-[#4A4A6A]">
          {analyzedMoves}/{totalMoves}
        </span>
      </div>

      {analyzedMoves > 0 && (
        <>
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

          <div className="max-h-[300px] overflow-y-auto space-y-0.5 scrollbar-thin">
            {results.map((r, idx) => {
              if (!r.actualMove) return null;
              return (
                <div
                  key={idx}
                  className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${
                    r.isProblem ? 'bg-red-500/10 border border-red-500/20' : ''
                  }`}
                >
                  <span className="w-8 font-mono text-[#8B8FA3] text-right shrink-0">
                    {r.moveNumber}
                  </span>
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      r.moveColor === 'black' ? 'bg-white border border-[#4A4A6A]' : 'bg-[#E0E0E0]'
                    }`}
                  />
                  <span className="w-8 font-mono font-semibold shrink-0">
                    {r.actualMove}
                  </span>
                  {r.winrate == null ? (
                    <span className="text-[#4A4A6A] text-[10px] shrink-0">--</span>
                  ) : r.isMatch ? (
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

      {analyzedMoves === 0 && (
        <div className="text-[10px] text-[#4A4A6A] text-center py-4">
          连接 AI 并浏览棋谱后将自动收集分析数据
        </div>
      )}
    </div>
  );
}
