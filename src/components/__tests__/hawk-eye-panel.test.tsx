import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import HawkEyePanel from '@/components/hawk-eye-panel';
import type { AnalysisCache, AnalysisInfo } from '@/lib/go-types';

function candidate(move: string, winrate: number): AnalysisInfo {
  return { move, winrate, scoreMean: 0, scoreStdev: 0, visits: 100, prior: 0.2, order: 0 };
}

function makeCache(entries: Array<[string, string, number]>): AnalysisCache {
  const cache: AnalysisCache = new Map();
  for (const [nodeId, move, winrate] of entries) {
    cache.set(nodeId, { data: [candidate(move, winrate)], winrate });
  }
  return cache;
}

describe('HawkEyePanel', () => {
  it('attributes a white blunder to the move that caused it and counts both colors', () => {
    // 3 手棋：黑 A19、白 B19（恶手）、黑 C19
    // 各局面缓存的是「行棋方视角」的 winrate：
    //   pos0 (黑走) 0.6 → blackWR .6
    //   pos1 (白走) 0.4 → blackWR .6
    //   pos2 (黑走) 0.7 → blackWR .7  ← 白 B19 让黑胜率 +10%
    //   pos3 (白走) 0.3 → blackWR .7（C19 没改变胜率）
    const cache = makeCache([
      ['root', 'A19', 0.6],
      ['a', 'B19', 0.4],
      ['b', 'C19', 0.7],
      ['c', 'D19', 0.3],
    ]);

    const { container } = render(
      <HawkEyePanel
        analysisCache={cache}
        analysisPathIds={['root', 'a', 'b', 'c']}
        gtpMoves={['B A19', 'W B19', 'B C19']}
      />,
    );

    const text = container.textContent ?? '';
    // 白方第 2 手的 -10% 必须挂在 B19 上，而不是错位到第 3 手 C19。
    expect(text).toContain('2B19-10.0%');
    expect(text).not.toContain('3C19-10.0%');
    // 黑白统计都覆盖全部 3 手，而不是漏掉第一手/互相错位。
    expect(text).toContain('黑棋2/2');
    expect(text).toContain('白棋1/1');
    expect(text).toContain('3/3');
  });

  it('reads records by node id, so same-depth branches do not collide', () => {
    const branchA = makeCache([
      ['root', 'B19', 0.5],
      ['a1', 'B19', 0.5],
    ]);
    const branchB = makeCache([
      ['root', 'B19', 0.5],
      ['b1', 'Q16', 0.5],
    ]);

    const first = render(
      <HawkEyePanel
        analysisCache={branchA}
        analysisPathIds={['root', 'a1']}
        gtpMoves={['B B19']}
      />,
    );
    expect(first.container.textContent).toMatch(/吻合率100\.0%/);
    first.unmount();

    const second = render(
      <HawkEyePanel
        analysisCache={branchB}
        analysisPathIds={['root', 'b1']}
        gtpMoves={['B Q16']}
      />,
    );
    expect(second.container.textContent).toMatch(/吻合率0\.0%/);
  });
});
