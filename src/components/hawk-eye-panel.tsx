'use client';

import type { AnalysisCache, AnalysisCacheEntry } from '@/lib/go-types';

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
  /** nodeId → analysis，缓存键必须是局面而不是手数 */
  analysisCache: AnalysisCache;
  /** 当前主线/分支的节点 id，下标 k 对应「已走 k 手」的局面 */
  analysisPathIds: string[];
  gtpMoves: string[];
  /** Jump to the given move number in the game tree. */
  onJumpToMove?: (moveNumber: number) => void;
  /** Hide the panel title (e.g. when rendered inside a tab bar that already labels it). */
  hideTitle?: boolean;
}

function computeResults(
  cache: AnalysisCache,
  pathIds: string[],
  gtpMoves: string[],
): HawkEyeMoveResult[] {
  const totalMoves = gtpMoves.length;
  const res: HawkEyeMoveResult[] = [];

  for (let k = 0; k <= totalMoves; k++) {
    const nodeId = pathIds[k];
    const record: AnalysisCacheEntry | undefined = nodeId ? cache.get(nodeId) : undefined;

    // 这手棋的颜色直接取 GTP 记录（兼容让子/同色连续等非标准交替）。
    const actualMove = k < totalMoves ? gtpMoves[k].split(' ')[1] : null;
    const moveColor: 'black' | 'white' | null = k < totalMoves
      ? (gtpMoves[k].startsWith('B') ? 'black' : 'white')
      : null;

    if (!record) {
      res.push({
        moveNumber: k + 1,
        moveColor,
        actualMove,
        winrate: null,
        aiBestMove: null,
        aiMatches: [],
        isMatch: false,
        isBest: false,
        matchRank: null,
        scoreMean: null,
        winrateDrop: null,
        isProblem: false,
        problemSeverity: 0,
      });
      continue;
    }

    const rawWR = record.winrate;
    // 引擎的 winrate 是「当前行棋方」视角；当前行棋方就是这手棋的颜色。
    const blackWR = rawWR != null && moveColor
      ? (moveColor === 'black' ? rawWR : 1 - rawWR)
      : null;

    const sorted = [...record.data].sort((a, b) => (a.order || 0) - (b.order || 0));

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
      moveNumber: k + 1,
      moveColor,
      actualMove,
      winrate: blackWR,
      aiBestMove: sorted[0]?.move ?? null,
      aiMatches: sorted.slice(0, 5).map(c => c.move),
      isMatch,
      isBest,
      matchRank,
      scoreMean: sorted[0]?.scoreLead ?? sorted[0]?.scoreMean ?? null,
      winrateDrop: null,
      isProblem: false,
      problemSeverity: 0,
    });
  }

  // 第 i 手（1-based）造成的胜率变化应归属 res[i-1]（actualMove 才是第 i 手），
  // 之前挂到 res[i] 会整体错位一手。
  for (let i = 1; i < res.length; i++) {
    const prevWR = res[i - 1].winrate;
    const currWR = res[i].winrate;
    if (prevWR == null || currWR == null) continue;

    const drop = currWR - prevWR; // 黑方胜率变化
    const target = res[i - 1];
    // 黑棋下输时 drop 为负，白棋下输时 drop 为正；统一存成负数表示亏损。
    target.winrateDrop = target.moveColor === 'black' ? drop : -drop;
  }

  for (let i = 0; i < res.length; i++) {
    const drop = res[i].winrateDrop;
    if (drop == null) continue;
    for (let s = PROBLEM_THRESHOLDS.length - 1; s >= 0; s--) {
      if (drop <= PROBLEM_THRESHOLDS[s]) {
        res[i].isProblem = s > 0;
        res[i].problemSeverity = s;
        break;
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
  const drops = analyzed.filter(r => r.winrateDrop != null);
  const avgDrop = drops.length > 0
    ? drops.reduce((s, r) => s + Math.abs(r.winrateDrop!), 0) / drops.length * 100
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
  analysisCache,
  analysisPathIds,
  gtpMoves,
  onJumpToMove,
  hideTitle,
}: HawkEyePanelProps) {
  // 直接从共享缓存派生，不维护组件内历史：移动端面板卸载/重建、清空棋盘、
  // 导入新 SGF 都不会留下上一局的残留数据。
  const results = computeResults(analysisCache, analysisPathIds, gtpMoves);
  const totalMoves = results.filter(r => r.actualMove).length;
  const analyzedTotal = results.filter(r => r.actualMove && r.winrate != null).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        {!hideTitle && (
          <span className="text-[#8B8FA3] text-xs uppercase tracking-wider">鹰眼分析</span>
        )}
        <span className="text-[10px] text-[#4A4A6A] ml-auto">
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
