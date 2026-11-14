import { describe, it, expect } from 'vitest';
import { buildAnalysisSyncKey, type AnalysisSyncKeyInput } from '@/lib/analysis-key';

const base: AnalysisSyncKeyInput = {
  nodeId: 'node_a',
  boardSize: 19,
  komi: 7.5,
  rules: 'chinese',
  player: 'black',
  moves: ['B Q16', 'W D4'],
};

describe('buildAnalysisSyncKey', () => {
  it('is stable for identical positions', () => {
    expect(buildAnalysisSyncKey(base)).toBe(buildAnalysisSyncKey({ ...base }));
  });

  it('changes when the same move count points to another branch', () => {
    const otherBranch = { ...base, nodeId: 'node_b' };
    expect(buildAnalysisSyncKey(base)).not.toBe(buildAnalysisSyncKey(otherBranch));
  });

  it('changes when komi / rules / player / moves change', () => {
    const key = buildAnalysisSyncKey(base);
    expect(buildAnalysisSyncKey({ ...base, komi: 6.5 })).not.toBe(key);
    expect(buildAnalysisSyncKey({ ...base, rules: 'japanese' })).not.toBe(key);
    expect(buildAnalysisSyncKey({ ...base, player: 'white' })).not.toBe(key);
    expect(buildAnalysisSyncKey({ ...base, moves: ['B Q16'] })).not.toBe(key);
  });

  it('includes handicap setup', () => {
    const key = buildAnalysisSyncKey(base);
    expect(buildAnalysisSyncKey({ ...base, handicapStones: ['D16'] })).not.toBe(key);
    expect(buildAnalysisSyncKey({ ...base, handicapWhiteStones: ['D4'] })).not.toBe(key);
  });
});
