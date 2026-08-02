'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { AnalysisInfo } from '@/lib/go-types';

interface HawkEyeRecord {
  candidates: AnalysisInfo[];
  winrate: number;
}

export interface HawkEyeMoveResult {
  moveNumber: number;
  moveColor: string | null;
  actualMove: string | null;
  winrate: number | null;
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

const SEVERITY_LABELS = ['', '疑问手', '失误', '恶手', '大恶手'];
const SEVERITY_COLORS = ['', '#FFD700', '#FF8C00', '#FF4500', '#DC143C'];
const SEVERITY_BG = ['', 'rgba(255,215,0,0.1)', 'rgba(255,140,0,0.1)', 'rgba(255,69,0,0.1)', 'rgba(220,20,60,0.1)'];
const PROBLEM_THRESHOLDS = [0, -0.03, -0.06, -0.12, -0.24];

interface HawkEyePanelProps {
  analysisData: AnalysisInfo[];
  currentWinrate: number | null;
  gtpMoves: string[];
  isConnected: boolean;
  /** Pre-built analysis cache from SGF import (offline mode). Populates internal history on mount. */
  analysisCache?: Map<number, { data: AnalysisInfo[]; winrate: number | null }>;
  /** Jump to the given move number in the game tree. */
  onJumpToMove?: (moveNumber: number) => void;
}

function computeResults(history: Map<number, HawkEyeRecord>, gtpMoves: string[]): HawkEyeMoveResult[] {
  const totalPositions = gtpMoves.length + 1;
  const res: HawkEyeMoveResult[] = [];

  for (let k = 0; k < totalPositions; k++) {
    const record = history.get(k);
    const moveColor = k > 0 ? (k % 2 === 1 ? 'black' : 'white') : null;
    const actualMove = k < gtpMoves.length ? gtpMoves[k].split(' ')[1] : null;

    if (!record) {
      res.push({
        moveNumber: k, moveColor, actualMove,
        winrate: null, aiBestMove: null, aiMatches: [], isMatch: false, isBest: false,
        matchRank: null, scoreMean: null, winrateDrop: null, isProblem: false, problemSeverity: 0,
      });
      continue;
    }

    const rawWR = record.winrate;
    const blackWR = rawWR != null ? (k % 2 === 0 ? rawWR : 1 - rawWR) : null;

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
      moveNumber: k, moveColor, actualMove,
      winrate: blackWR,
      aiBestMove: sorted[0]?.move ?? null,
      aiMatches: sorted.slice(0, 5).map(c => c.move),
      isMatch, isBest, matchRank,
      scoreMean: sorted[0]?.scoreMean ?? sorted[0]?.scoreLead ?? null,
      winrateDrop: null,
      isProblem: false,
      problemSeverity: 0,
    });
  }

  for (let i = 1; i < res.length; i++) {
    const prev = res[i - 1];
    const curr = res[i];
    if (prev.winrate != null && curr.winrate != null) {
      const drop = curr.winrate - prev.winrate;
      curr.winrateDrop = curr.moveColor === 'black' ? drop : -drop;
    }
  }

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
}

function ColorStats({ results, color, colorClass }: { results: HawkEyeMoveResult[]; color: string; colorClass: string }) {
  const moves = results.filter(r => r.actualMove && r.moveColor === color);
  const analyzed = moves.filter(r => r.winrate != null);
  const matchCount = analyzed.filter(r => r.isMatch).length;
  const bestCount = analyzed.filter(r => r.isBest).length;
  const matchRate = analyzed.length > 0 ? (matchCount / analyzed.length * 100).toFixed(1) : '--';
  const bestRate = analyzed.length > 0 ? (bestCount / analyzed.length * 100).toFixed(1) : '--';
  const problemMoves = analyzed.filter(r => r.isProblem);
  const avgDrop = analyzed.length > 0
    ? analyzed.filter(r => r.winrateDrop != null).reduce((s, r) => s + Math.abs(r.winrateDrop!), 0) / analyzed.length * 100
    : 0;

  return (
    <div className="bg-[#1A1A2E]/50 rounded p-2 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${colorClass}`} />
        <span className="text-xs font-medium text-[#C8CAD0]">{color === 'black' ? '黑棋' : '白棋'}</span>
        <span className="text-[10px] text-[#4A4A6A] ml-auto">{analyzed.length}/{moves.length}</span>
      </div>
      <div className="grid grid-cols-2 gap-1 text-xs">
        <div className="text-[#8B8FA3]">吻合率</div>
        <div className="text-right font-mono text-[#4ADE80]">{matchRate}%</div>
        <div className="text-[#8B8FA3]">首选命中</div>
        <div className="text-right font-mono text-[#4A9EFF]">{bestRate}%</div>
        <div className="text-[#8B8FA3]">问题手</div>
        <div className="text-right font-mono text-[#FF6B6B]">{problemMoves.length}</div>
        <div className="text-[#8B8FA3]">平均亏损</div>
        <div className="text-right font-mono text-[#E8B931]">{avgDrop.toFixed(1)}%</div>
      </div>
    </div>
  );
}

export default function HawkEyePanel({
  analysisData,
  currentWinrate,
  gtpMoves,
  isConnected,
  analysisCache,
  onJumpToMove,
}: HawkEyePanelProps) {
  const historyRef = useRef<Map<number, HawkEyeRecord>>(new Map());
  const [version, setVersion] = useState(0);

  const analysisDataRef = useRef(analysisData);
  analysisDataRef.current = analysisData;
  const winrateRef = useRef(currentWinrate);
  winrateRef.current = currentWinrate;
  const movesRef = useRef(gtpMoves);
  movesRef.current = gtpMoves;

  // Populate historyRef from pre-built analysis cache (SGF import / offline mode)
  const populatedCacheRef = useRef<Map<number, { data: AnalysisInfo[]; winrate: number | null }> | undefined>(undefined);
  useEffect(() => {
    if (!analysisCache || analysisCache.size === 0) return;
    // Skip if we've already populated from this exact cache instance
    if (analysisCache === populatedCacheRef.current) return;
    populatedCacheRef.current = analysisCache;

    historyRef.current.clear();
    analysisCache.forEach((record, key) => {
      historyRef.current.set(key, {
        candidates: record.data,
        winrate: record.winrate ?? 0,
      });
    });
    setVersion(v => v + 1);
  }, [analysisCache]);

  useEffect(() => {
    if (!isConnected) return;

    const timer = setInterval(() => {
      const moves = movesRef.current;
      const posIdx = moves.length;
      if (analysisDataRef.current.length === 0) return;
      const record: HawkEyeRecord = {
        candidates: analysisDataRef.current,
        winrate: winrateRef.current ?? 0,
      };
      historyRef.current.set(posIdx, record);
      setVersion(v => v + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isConnected]);

  const results = useMemo(
    () => computeResults(historyRef.current, gtpMoves),
    [version, gtpMoves]
  );

  const totalMoves = results.filter(r => r.actualMove).length;
  const analyzedTotal = results.filter(r => r.actualMove && r.winrate != null).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[#8B8FA3] text-xs uppercase tracking-wider">鹰眼分析</span>
        <span className="text-[10px] text-[#4A4A6A]">
          {analyzedTotal}/{totalMoves}
        </span>
      </div>

      {analyzedTotal > 0 ? (
        <>
          <ColorStats results={results} color="black" colorClass="bg-[#18181B] border border-[#4A4A6A]" />
          <ColorStats results={results} color="white" colorClass="bg-[#F5F5F5] border border-[#6B6B80]" />

          <div className="max-h-[300px] overflow-y-auto space-y-0.5 scrollbar-thin">
            {(() => {
              const problems = results.filter(r => r.actualMove && r.isProblem);
              if (problems.length === 0) {
                return (
                  <div className="text-[10px] text-[#4A4A6A] text-center py-2">
                    无问题手
                  </div>
                );
              }
              return problems.map((r, idx) => (
                <div
                  key={idx}
                  onClick={() => onJumpToMove?.(r.moveNumber)}
                  className="flex items-center gap-2 px-2 py-1 rounded text-xs cursor-pointer transition-colors hover:bg-[#1A1A2E]/80"
                  style={{ backgroundColor: SEVERITY_BG[r.problemSeverity] }}
                >
                  <span className="w-6 font-mono text-[#8B8FA3] text-right shrink-0">
                    {r.moveNumber}
                  </span>
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      r.moveColor === 'black' ? 'bg-[#18181B] border border-[#5A5A6A]' : 'bg-[#F5F5F5] border border-[#6B6B80]'
                    }`}
                  />
                  <span className="w-8 font-mono font-semibold shrink-0">
                    {r.actualMove}
                  </span>
                  {r.aiBestMove && !r.isMatch && (
                    <span className="text-[#4A4A6A] font-mono text-[10px]">
                      {'\u2192'}{r.aiBestMove}
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
                  <span
                    className="text-[10px] font-medium shrink-0"
                    style={{ color: SEVERITY_COLORS[r.problemSeverity] }}
                  >
                    {SEVERITY_LABELS[r.problemSeverity]}
                  </span>
                </div>
              ));
            })()}
          </div>
        </>
      ) : (
        <div className="text-[10px] text-[#4A4A6A] text-center py-4">
          连接 AI 并浏览棋谱后将自动收集分析数据
        </div>
      )}
    </div>
  );
}
