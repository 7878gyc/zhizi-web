import { describe, it, expect } from 'vitest';
import {
  AI_CONFIGS,
  buildArgsString,
  coordToGTP,
  gtpToCoord,
  sgfToCoord,
  coordToSgf,
  sgfToGTP,
  parseInfoLine,
  parseAnalysisLine,
  findNode,
  getPathToNode,
  generateNodeId,
  createRootNode,
  type MoveNode,
} from '@/lib/go-types';

describe('coordToGTP / gtpToCoord', () => {
  it('converts top-left corner (0,0) to A19', () => {
    expect(coordToGTP(0, 0)).toBe('A19');
  });

  it('converts bottom-right corner (18,18) to T1', () => {
    expect(coordToGTP(18, 18)).toBe('T1');
  });

  it('converts center (9,9) to K10 (skips letter I)', () => {
    expect(coordToGTP(9, 9)).toBe('K10');
  });

  it('skips the letter I when crossing column 7→8', () => {
    expect(coordToGTP(0, 7)).toBe('H19');
    expect(coordToGTP(0, 8)).toBe('J19');
  });

  it('round-trips coordToGTP and gtpToCoord', () => {
    for (let row = 0; row < 19; row++) {
      for (let col = 0; col < 19; col++) {
        const gtp = coordToGTP(row, col);
        const { row: r2, col: c2 } = gtpToCoord(gtp);
        expect([r2, c2]).toEqual([row, col]);
      }
    }
  });

  it('parses GTP coordinates case-insensitively', () => {
    expect(gtpToCoord('q16')).toEqual({ row: 3, col: 15 });
    expect(gtpToCoord('Q16')).toEqual({ row: 3, col: 15 });
  });

  it('respects custom board size', () => {
    expect(coordToGTP(0, 0, 9)).toBe('A9');
    expect(gtpToCoord('E5', 9)).toEqual({ row: 4, col: 4 });
  });
});

describe('SGF coordinate conversion', () => {
  it('converts SGF coord to row/col', () => {
    expect(sgfToCoord('aa')).toEqual({ row: 0, col: 0 });
    expect(sgfToCoord('ss')).toEqual({ row: 18, col: 18 });
    expect(sgfToCoord('jj')).toEqual({ row: 9, col: 9 });
  });

  it('round-trips coordToSgf and sgfToCoord', () => {
    for (let row = 0; row < 19; row++) {
      for (let col = 0; col < 19; col++) {
        const sgf = coordToSgf(row, col);
        const { row: r2, col: c2 } = sgfToCoord(sgf);
        expect([r2, c2]).toEqual([row, col]);
      }
    }
  });

  it('converts SGF dd to GTP D16', () => {
    expect(sgfToGTP('dd')).toBe('D16');
  });

  it('converts SGF qq to GTP R3', () => {
    expect(sgfToGTP('qq')).toBe('R3');
  });
});

describe('buildArgsString & AI_CONFIGS', () => {
  it('generates all GPU x weight combinations', () => {
    expect(AI_CONFIGS).toHaveLength(5 * 3);
    expect(AI_CONFIGS.every(c => c.platform === 'all')).toBe(true);
    expect(AI_CONFIGS.every(c => c.engineType === 'go')).toBe(true);
  });

  it('builds the expected argument string', () => {
    const cfg = AI_CONFIGS.find(c => c.gpuType === '1x' && c.kataWeight === '18b')!;
    expect(buildArgsString(cfg)).toBe(
      '--platform all --engine-type go --gpu-type 1x --kata-name katago-TENSORRT --kata-weight 18b'
    );
  });
});

describe('parseInfoLine', () => {
  it('parses a single info block with float winrate', () => {
    const line = 'info move D4 winrate 0.61 visits 120 scoreMean 2.5 scoreStdev 1.2 prior 0.2 order 0';
    const result = parseInfoLine(line);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      move: 'D4',
      winrate: 0.61,
      visits: 120,
      scoreMean: 2.5,
      scoreStdev: 1.2,
      prior: 0.2,
      order: 0,
    });
  });

  it('normalizes percent-style winrate/prior (>/10000)', () => {
    const line = 'info move D4 winrate 6100 visits 100 prior 2500 order 0';
    const [info] = parseInfoLine(line);
    expect(info.winrate).toBe(0.61);
    expect(info.prior).toBe(0.25);
  });

  it('parses multiple concatenated info blocks', () => {
    const line =
      'info move D4 winrate 0.61 visits 120 scoreMean 2.5 scoreStdev 1.2 prior 0.2 order 0 ' +
      'info move Q16 winrate 0.39 visits 90 scoreMean -2.5 scoreStdev 1.5 prior 0.15 order 1';
    const result = parseInfoLine(line);
    expect(result).toHaveLength(2);
    expect(result[0].move).toBe('D4');
    expect(result[1].move).toBe('Q16');
    expect(result[1].order).toBe(1);
  });

  it('captures pv as an array of moves', () => {
    const line = 'info move D4 winrate 0.6 visits 10 scoreMean 1.0 scoreStdev 0.5 prior 0.3 order 0 pv D4 Q16 C17';
    const [info] = parseInfoLine(line);
    expect(info.pv).toEqual(['D4', 'Q16', 'C17']);
  });

  it('ignores blocks without a move', () => {
    const line = 'info winrate 0.5 visits 10 scoreMean 0 scoreStdev 0 prior 0.1 order 0';
    expect(parseInfoLine(line)).toEqual([]);
  });

  it('handles unknown keys by skipping them', () => {
    const line = 'info move D4 winrate 0.6 visits 10 scoreMean 1.0 scoreStdev 0.5 prior 0.3 order 0 lcb 0.9 weight 1.0';
    const [info] = parseInfoLine(line);
    expect(info.move).toBe('D4');
    expect(info.winrate).toBe(0.6);
  });

  it('parses integer keys as integers and floats as floats', () => {
    const line = 'info move D4 winrate 0.6 visits 100 scoreMean 1.5 scoreStdev 0.5 prior 0.3 order 0';
    const [info] = parseInfoLine(line);
    expect(info.visits).toBe(100);
    expect(info.order).toBe(0);
    expect(typeof info.visits).toBe('number');
  });

  it('returns empty array for empty or junk input', () => {
    expect(parseInfoLine('')).toEqual([]);
    expect(parseInfoLine('kata-analyze B 50')).toEqual([]);
  });
});

describe('parseAnalysisLine', () => {
  it('returns the first candidate (legacy API)', () => {
    const line = 'info move D4 winrate 0.6 visits 10 scoreMean 1.0 scoreStdev 0.5 prior 0.3 order 0';
    const info = parseAnalysisLine(line);
    expect(info?.move).toBe('D4');
    expect(info?.winrate).toBe(0.6);
  });

  it('returns null when no candidate matches', () => {
    expect(parseAnalysisLine('random output')).toBeNull();
  });
});

describe('move tree utilities', () => {
  function buildTree(): MoveNode {
    return {
      id: 'root',
      move: 'root',
      color: null,
      children: [
        {
          id: 'n1',
          move: 'D4',
          color: 'black',
          children: [
            { id: 'n2', move: 'Q16', color: 'white', children: [], parentId: 'n1', moveNumber: 2 },
            { id: 'n3', move: 'C17', color: 'white', children: [], parentId: 'n1', moveNumber: 2 },
          ],
          parentId: 'root',
          moveNumber: 1,
        },
      ],
      parentId: null,
      moveNumber: 0,
    };
  }

  it('finds a node by id (including root)', () => {
    const tree = buildTree();
    expect(findNode(tree, 'root')?.id).toBe('root');
    expect(findNode(tree, 'n2')?.move).toBe('Q16');
    expect(findNode(tree, 'missing')).toBeNull();
  });

  it('returns the path from root to target', () => {
    const tree = buildTree();
    const path = getPathToNode(tree, 'n3');
    expect(path.map(n => n.id)).toEqual(['root', 'n1', 'n3']);
  });

  it('returns just the root when targeting root', () => {
    const tree = buildTree();
    expect(getPathToNode(tree, 'root').map(n => n.id)).toEqual(['root']);
  });

  it('returns empty path for unknown target', () => {
    const tree = buildTree();
    expect(getPathToNode(tree, 'nope')).toEqual([]);
  });
});

describe('node creation', () => {
  it('creates a valid root node', () => {
    const root = createRootNode();
    expect(root).toEqual({
      id: 'root',
      move: 'root',
      color: null,
      children: [],
      parentId: null,
      moveNumber: 0,
    });
  });

  it('generates unique ids', () => {
    const a = generateNodeId();
    const b = generateNodeId();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^node_\d+_\d+_[a-z0-9]{3}$/);
  });
});
