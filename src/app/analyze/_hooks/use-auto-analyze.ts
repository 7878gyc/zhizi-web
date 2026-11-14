'use client';

import { useRef, useEffect } from 'react';

/**
 * 自动分析：只有当前局面已经有分析结果时才前进，避免在引擎还没算完时
 * 每 2 秒盲目跳下一步，导致每个局面都只分析一小会儿。
 */
export function useAutoAnalyze(
  isActive: boolean,
  isConnected: boolean,
  goToNextMove: () => void,
  canAdvance?: () => boolean,
) {
  const autoAnalyzeRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const goToNextRef = useRef(goToNextMove);
  const canAdvanceRef = useRef(canAdvance);

  useEffect(() => {
    goToNextRef.current = goToNextMove;
    canAdvanceRef.current = canAdvance;
  });

  useEffect(() => {
    if (isActive && isConnected) {
      autoAnalyzeRef.current = setInterval(() => {
        if (canAdvanceRef.current && !canAdvanceRef.current()) return;
        goToNextRef.current();
      }, 2000);
    }

    return () => {
      if (autoAnalyzeRef.current) {
        clearInterval(autoAnalyzeRef.current);
        autoAnalyzeRef.current = null;
      }
    };
  }, [isActive, isConnected]);
}
