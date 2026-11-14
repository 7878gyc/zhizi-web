'use client';

import { useRef, useEffect } from 'react';
import type { AnalysisInfo } from '@/lib/go-types';

interface CacheEntry {
  data: AnalysisInfo[];
  winrate: number | null;
}

/**
 * 按局面（MoveNode.id）缓存实时分析，而不是按手数。
 *
 * 同一手数可能对应不同分支；按手数缓存会让分支互相覆盖，也会在跳转时
 * 把上一个局面的数据写到新局面的键下。
 */
export function useAnalysisCache(
  analysisData: AnalysisInfo[],
  currentWinrate: number | null,
  analysisNodeId: string,
  currentNodeId: string,
  setDisplayAnalysis: (v: AnalysisInfo[]) => void,
  setDisplayWinrate: (v: number | null) => void,
) {
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());

  // 缓存最近一次到达的分析。只有它确实属于当前展示的局面时才刷新展示，
  // 避免导航瞬间把旧局面的 info 显示成新局面的分析。
  useEffect(() => {
    if (analysisData.length === 0) return;

    cacheRef.current.set(analysisNodeId, {
      data: analysisData,
      winrate: currentWinrate,
    });

    if (analysisNodeId === currentNodeId) {
      setDisplayAnalysis(analysisData);
      setDisplayWinrate(currentWinrate);
    }
  }, [
    analysisData,
    currentWinrate,
    analysisNodeId,
    currentNodeId,
    setDisplayAnalysis,
    setDisplayWinrate,
  ]);

  return { cacheRef };
}
