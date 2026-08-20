import { describe, it, expect } from 'vitest';
import { sgfToGtpCoord, generateSGF, generatePureSGF, generateAnalyzedSGF } from '@/lib/sgf';
import type { MoveNode, AnalysisInfo } from '@/lib/go-types';

describe('sgfToGtpCoord', () => {
  it('converts lowercase SGF coords to GTP', () => {
    expect(sgfToGtpCoord('pd', 19)).toBe('Q16');
    expect(sgfToGtpCoord('dp', 19)).toBe('D4');
    expect(sgfToGtpCoord('jj', 19)).toBe('K10');
    expect(sgfToGtpCoord('aa', 19)).toBe('A19');
  });

  it('handles non-19 boards', () => {
    expect(sgfToGtpCoord('ee', 9)).toBe('E5');
  });

  it('returns empty string for invalid input', () => {
    expect(sgfToGtpCoord('', 19)).toBe('');
    expect(sgfToGtpCoord('a', 19)).toBe('');
    expect(sgfToGtpCoord('zz', 19)).toBe('');
    expect(sgfToGtpCoord('ss', 9)).toBe('');
  });
});

function buildTree(moves: { move: string; color: 'black' | 'white' }[]): MoveNode {
  const root: MoveNode = {
    id: 'root',
    move: 'root',
    color: null,
    children: [],
    parentId: null,
    moveNumber: 0,
  };
  let parent = root;
  moves.forEach((m, i) => {
    const node: MoveNode = {
      id: `n${i + 1}`,
      move: m.move,
      color: m.color,
      children: [],
      parentId: parent.id,
      moveNumber: i + 1,
    };
    parent.children = [node];
    parent = node;
  });
  return root;
}

describe('generateSGF', () => {
  it('generates a minimal SGF with header properties', () => {
    const sgf = generateSGF({
      boardSize: 19,
      komi: 7.5,
      rules: 'chinese',
      moveTree: buildTree([{ move: 'Q16', color: 'black' }]),
    });
    expect(sgf).toContain('GM[1]');
    expect(sgf).toContain('FF[4]');
    expect(sgf).toContain('CA[UTF-8]');
    expect(sgf).toContain('SZ[19]');
    expect(sgf).toContain('KM[7.5]');
    expect(sgf).toContain('RU[chinese]');
    expect(sgf).toContain('PB[Black]');
    expect(sgf).toContain('PW[White]');
    expect(sgf).toContain(';B[pd]');
    expect(sgf.endsWith(')')).toBe(true);
    expect(sgf.startsWith('(;')).toBe(true);
  });

  it('interleaves black and white moves', () => {
    const sgf = generateSGF({
      boardSize: 19,
      komi: 7.5,
      rules: 'chinese',
      moveTree: buildTree([
        { move: 'Q16', color: 'black' },
        { move: 'D4', color: 'white' },
      ]),
    });
    expect(sgf).toContain(';B[pd]');
    expect(sgf).toContain(';W[dp]');
    const bIdx = sgf.indexOf(';B[pd]');
    const wIdx = sgf.indexOf(';W[dp]');
    expect(bIdx).toBeLessThan(wIdx);
  });

  it('skips non-main-branch children', () => {
    const root: MoveNode = {
      id: 'root',
      move: 'root',
      color: null,
      children: [
        {
          id: 'n1',
          move: 'Q16',
          color: 'black',
          children: [
            { id: 'n2', move: 'D4', color: 'white', children: [], parentId: 'n1', moveNumber: 2 },
            { id: 'n3', move: 'C17', color: 'white', children: [], parentId: 'n1', moveNumber: 2 },
          ],
          parentId: 'root',
          moveNumber: 1,
        },
      ],
      parentId: null,
      moveNumber: 0,
    };
    const sgf = generateSGF({ boardSize: 19, komi: 7.5, rules: 'chinese', moveTree: root });
    expect(sgf).toContain(';B[pd]');
    expect(sgf).toContain(';W[dp]');
    expect(sgf).not.toContain(';W[cq]');
  });

  it('escapes player names and comment text', () => {
    const sgf = generateSGF({
      boardSize: 19,
      komi: 7.5,
      rules: 'chinese',
      moveTree: buildTree([{ move: 'Q16', color: 'black' }]),
      playerBlack: 'Bob]the\\builder',
    });
    expect(sgf).toContain('PB[Bob\\]the\\\\builder]');
  });

  it('escapes rules and komi formatting', () => {
    const sgf = generateSGF({
      boardSize: 9,
      komi: 6.5,
      rules: 'japanese',
      moveTree: buildTree([]),
    });
    expect(sgf).toContain('SZ[9]');
    expect(sgf).toContain('KM[6.5]');
    expect(sgf).toContain('RU[japanese]');
  });
});

describe('generateAnalyzedSGF', () => {
  const candidates: AnalysisInfo[] = [
    {
      move: 'Q16',
      winrate: 0.61,
      scoreMean: 2.5,
      scoreStdev: 1.2,
      visits: 1200,
      prior: 0.25,
      order: 0,
      pv: ['Q16', 'D4'],
    },
  ];

  it('includes LZ and C properties when analysis is available', () => {
    const analysisCache = new Map([[1, { data: candidates, winrate: 0.61 }]]);
    const sgf = generateSGF({
      boardSize: 19,
      komi: 7.5,
      rules: 'chinese',
      moveTree: buildTree([{ move: 'Q16', color: 'black' }]),
      analysisCache,
      includeAnalysis: true,
    });
    expect(sgf).toContain('LZ[');
    expect(sgf).toContain('C[');
    // LZ header: "KataGo 61 1.2k 2.50 1.20\nmove pd visits 1200 ..."
    expect(sgf).toContain('KataGo 61 1.2k 2.50 1.20');
    expect(sgf).toContain('move pd visits 1200 winrate 6100 prior 2500 scoreMean 2.50');
  });

  it('omits analysis when includeAnalysis is false', () => {
    const analysisCache = new Map([[1, { data: candidates, winrate: 0.61 }]]);
    const sgf = generateSGF({
      boardSize: 19,
      komi: 7.5,
      rules: 'chinese',
      moveTree: buildTree([{ move: 'Q16', color: 'black' }]),
      analysisCache,
      includeAnalysis: false,
    });
    expect(sgf).not.toContain('LZ[');
    expect(sgf).not.toContain('C[');
  });

  it('generatePureSGF never includes analysis', () => {
    const analysisCache = new Map([[1, { data: candidates, winrate: 0.61 }]]);
    const sgf = generatePureSGF({
      boardSize: 19,
      komi: 7.5,
      rules: 'chinese',
      moveTree: buildTree([{ move: 'Q16', color: 'black' }]),
      analysisCache,
    });
    expect(sgf).not.toContain('LZ[');
  });

  it('generateAnalyzedSGF includes analysis', () => {
    const analysisCache = new Map([[1, { data: candidates, winrate: 0.61 }]]);
    const sgf = generateAnalyzedSGF({
      boardSize: 19,
      komi: 7.5,
      rules: 'chinese',
      moveTree: buildTree([{ move: 'Q16', color: 'black' }]),
      analysisCache,
    });
    expect(sgf).toContain('LZ[');
  });

  it('formats visit counts with k/m suffixes', () => {
    const c1: AnalysisInfo = {
      move: 'Q16',
      winrate: 0.5,
      scoreMean: 0,
      scoreStdev: 1,
      visits: 1500000,
      prior: 0.1,
      order: 0,
    };
    const analysisCache = new Map([[1, { data: [c1], winrate: 0.5 }]]);
    const sgf = generateSGF({
      boardSize: 19,
      komi: 7.5,
      rules: 'chinese',
      moveTree: buildTree([{ move: 'Q16', color: 'black' }]),
      analysisCache,
      includeAnalysis: true,
    });
    expect(sgf).toContain('KataGo 50 1.5m');
  });
});
