import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useState } from 'react';
import { useAnalysisCache } from '@/app/analyze/_hooks/use-analysis-cache';
import type { AnalysisInfo } from '@/lib/go-types';

const infoA: AnalysisInfo = {
  move: 'Q16', winrate: 0.6, scoreMean: 1, scoreStdev: 1, visits: 100, prior: 0.3, order: 0,
};
const infoB: AnalysisInfo = { ...infoA, move: 'D4' };

interface Props {
  analysisData: AnalysisInfo[];
  currentWinrate: number | null;
  analysisNodeId: string;
  currentNodeId: string;
}

function useHarness({ analysisData, currentWinrate, analysisNodeId, currentNodeId }: Props) {
  const [displayAnalysis, setDisplayAnalysis] = useState<AnalysisInfo[]>([]);
  const [displayWinrate, setDisplayWinrate] = useState<number | null>(null);
  const { cacheRef } = useAnalysisCache(
    analysisData,
    currentWinrate,
    analysisNodeId,
    currentNodeId,
    setDisplayAnalysis,
    setDisplayWinrate,
  );
  return { cacheRef, displayAnalysis, displayWinrate };
}

describe('useAnalysisCache', () => {
  it('caches by nodeId and displays only when it belongs to the current position', () => {
    const { result, rerender } = renderHook((props: Props) => useHarness(props), {
      initialProps: {
        analysisData: [infoA],
        currentWinrate: 0.6,
        analysisNodeId: 'node_a',
        currentNodeId: 'node_a',
      },
    });

    expect(result.current.cacheRef.current.get('node_a')?.data).toEqual([infoA]);
    expect(result.current.displayAnalysis).toEqual([infoA]);
    expect(result.current.displayWinrate).toBe(0.6);

    // 用户已跳到 node_b，但引擎还在吐 node_a 的旧数据：只缓存，不展示。
    rerender({
      analysisData: [infoA],
      currentWinrate: 0.6,
      analysisNodeId: 'node_a',
      currentNodeId: 'node_b',
    });
    expect(result.current.cacheRef.current.get('node_b')).toBeUndefined();
    expect(result.current.displayAnalysis).toEqual([infoA]);

    // 新局面的数据到达后才刷新展示。
    rerender({
      analysisData: [infoB],
      currentWinrate: 0.4,
      analysisNodeId: 'node_b',
      currentNodeId: 'node_b',
    });
    expect(result.current.cacheRef.current.get('node_b')?.data).toEqual([infoB]);
    expect(result.current.displayAnalysis).toEqual([infoB]);
    expect(result.current.displayWinrate).toBe(0.4);
  });
});
