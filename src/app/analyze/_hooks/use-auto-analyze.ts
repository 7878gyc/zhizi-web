'use client';

import { useRef, useEffect } from 'react';

export function useAutoAnalyze(isActive: boolean, isConnected: boolean, goToNextMove: () => void) {
  const autoAnalyzeRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const goToNextRef = useRef(goToNextMove);
  goToNextRef.current = goToNextMove;

  useEffect(() => {
    if (isActive && isConnected) {
      autoAnalyzeRef.current = setInterval(() => {
        goToNextRef.current();
      }, 2000);
    } else {
      if (autoAnalyzeRef.current) {
        clearInterval(autoAnalyzeRef.current);
        autoAnalyzeRef.current = null;
      }
    }
    return () => {
      if (autoAnalyzeRef.current) {
        clearInterval(autoAnalyzeRef.current);
      }
    };
  }, [isActive, isConnected]);
}
