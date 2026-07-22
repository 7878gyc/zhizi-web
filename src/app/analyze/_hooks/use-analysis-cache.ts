'use client';

import { useRef, useState, useEffect } from 'react';
import type { AnalysisInfo } from '@/lib/go-types';

interface CacheEntry {
  data: AnalysisInfo[];
  winrate: number | null;
}

export function useAnalysisCache(
  analysisData: AnalysisInfo[],
  currentWinrate: number | null,
  gtpMoves: string[],
  displayAnalysis: AnalysisInfo[],
  setDisplayAnalysis: (v: AnalysisInfo[]) => void,
  setDisplayWinrate: (v: number | null) => void,
) {
  const cacheRef = useRef<Map<number, CacheEntry>>(new Map());
  const analysisDataRef = useRef(analysisData);
  analysisDataRef.current = analysisData;
  const currentWinrateRef = useRef(currentWinrate);
  currentWinrateRef.current = currentWinrate;
  const prevMoveCountRef = useRef(-1);

  // Cache live analysis data whenever it arrives
  useEffect(() => {
    if (analysisData.length > 0) {
      const idx = gtpMoves.length;
      cacheRef.current.set(idx, { data: analysisData, winrate: currentWinrate });
      setDisplayAnalysis(analysisData);
      setDisplayWinrate(currentWinrate);
    }
  }, [analysisData, currentWinrate, gtpMoves.length, setDisplayAnalysis, setDisplayWinrate]);

  return {
    cacheRef,
    analysisDataRef,
    currentWinrateRef,
    prevMoveCountRef,
  };
}
