import { describe, it, expect } from 'vitest';
import { parseSgf, sgfToMoveTree, parseSgfContent } from '@/lib/sgf-parser';

describe('parseSgf', () => {
  it('parses header properties (SZ, KM, RU, PB, PW)', () => {
    const sgf = '(;GM[1]FF[4]SZ[13]KM[6.5]RU[japanese]PB[Alice]PW[Bob])';
    const result = parseSgf(sgf);
    expect(result.boardSize).toBe(13);
    expect(result.komi).toBe(6.5);
    expect(result.rules).toBe('japanese');
    expect(result.playerBlack).toBe('Alice');
    expect(result.playerWhite).toBe('Bob');
  });

  it('handles AGA and chinese rules variants', () => {
    expect(parseSgf('(;RU[AGA])').rules).toBe('aga');
    expect(parseSgf('(;RU[Chinese])').rules).toBe('chinese');
    expect(parseSgf('(;RU[ing])').rules).toBe('chinese');
  });

  it('applies defaults when properties are missing', () => {
    const result = parseSgf('(;)');
    expect(result.boardSize).toBe(19);
    expect(result.komi).toBe(7.5);
    expect(result.rules).toBe('chinese');
  });

  it('strips BOM and preamble before the first parenthesis', () => {
    const sgf = '\uFEFFsome preamble text\n(;SZ[9])';
    expect(parseSgf(sgf).boardSize).toBe(9);
  });

  it('handles line breaks and escaped characters in values', () => {
    const sgf = '(;PB[Li\\]Ke]PW[Wang];B[dd])';
    const result = parseSgf(sgf);
    expect(result.playerBlack).toBe('Li]Ke');
    expect(result.root.children).toHaveLength(1);
    expect(result.root.children[0].properties.B).toEqual(['dd']);
  });

  it('throws on input without a root node', () => {
    expect(() => parseSgf('no parens here')).toThrow('Invalid SGF');
  });
});

describe('sgfToMoveTree', () => {
  it('returns null for invalid SGF', () => {
    expect(sgfToMoveTree('garbage')).toBeNull();
  });

  it('converts a linear game into a MoveNode tree', () => {
    const sgf = '(;GM[1]SZ[19]KM[7.5];B[pd];W[dp];B[qf])';
    const result = sgfToMoveTree(sgf)!;
    expect(result).not.toBeNull();
    expect(result.tree.id).toBe('root');
    expect(result.tree.move).toBe('root');
    expect(result.tree.moveNumber).toBe(0);

    const [n1] = result.tree.children;
    expect(n1.move).toBe('Q16');
    expect(n1.color).toBe('black');
    expect(n1.moveNumber).toBe(1);
    expect(n1.parentId).toBe('root');

    const [n2] = n1.children;
    expect(n2.move).toBe('D4');
    expect(n2.color).toBe('white');
    expect(n2.moveNumber).toBe(2);

    const [n3] = n2.children;
    expect(n3.move).toBe('R14');
    expect(n3.moveNumber).toBe(3);
  });

  it('ignores pass moves and non-coordinate moves', () => {
    const sgf = '(;SZ[19];B[tt];W[dp])';
    const result = sgfToMoveTree(sgf)!;
    expect(result.tree.children).toHaveLength(1);
    expect(result.tree.children[0].move).toBe('D4');
  });

  it('parses branches as sibling children of the parent node', () => {
    const sgf = '(;SZ[19];B[pd];W[dp](;B[qf])(;B[qc]))';
    const result = sgfToMoveTree(sgf)!;
    const n1 = result.tree.children[0];
    const n2 = n1.children[0];
    expect(n2.children).toHaveLength(2);
    expect(n2.children[0].move).toBe('R14');
    expect(n2.children[1].move).toBe('R17');
  });

  it('parses LZ analysis data into winrate and candidates', () => {
    const sgf =
      '(;GM[1]SZ[19]KM[7.5];B[pd]LZ[KataGo 61 1200 2.50 1.20\\nmove pd visits 1200 winrate 6100 prior 2500 scoreMean 2.50 pv pd dp];W[dp])';
    const result = sgfToMoveTree(sgf)!;
    const n1 = result.tree.children[0];

    // black node: engine analyzed from white's perspective → black WR = 1 - 0.61
    expect(n1.winrate).toBeCloseTo(0.39);
    const cached = result.analysisCache.get(1);
    expect(cached).toBeDefined();
    expect(cached!.data).toHaveLength(1);
    expect(cached!.data[0].move).toBe('Q16');
    expect(cached!.data[0].winrate).toBeCloseTo(0.61);
    expect(cached!.data[0].visits).toBe(1200);
    expect(cached!.data[0].pv).toEqual(['Q16', 'D4']);
    expect(cached!.winrate).toBeCloseTo(0.61);
  });

  it('parses LZ data with newlines already stripped (backward compat)', () => {
    const sgf =
      '(;GM[1]SZ[19]KM[7.5];B[pd]LZ[KataGo 61 1200 2.50 1.20move pd visits 1200 winrate 6100 prior 2500 scoreMean 2.50])';
    const result = sgfToMoveTree(sgf)!;
    const cached = result.analysisCache.get(1);
    expect(cached).toBeDefined();
    expect(cached!.data).toHaveLength(1);
    expect(cached!.data[0].move).toBe('Q16');
  });

  it('skips LZ data with unrecognized format', () => {
    const sgf = '(;SZ[19];B[pd]LZ[garbage])';
    const result = sgfToMoveTree(sgf)!;
    expect(result.tree.children[0].winrate).toBeUndefined();
    expect(result.analysisCache.has(1)).toBe(false);
  });

  it('extracts komi, rules and players from the header', () => {
    const sgf = '(;GM[1]SZ[19]KM[5.5]RU[aga]PB[X]PW[Y];B[pd])';
    const result = sgfToMoveTree(sgf)!;
    expect(result.komi).toBe(5.5);
    expect(result.rules).toBe('aga');
    expect(result.playerBlack).toBe('X');
    expect(result.playerWhite).toBe('Y');
  });
});

describe('parseSgfContent', () => {
  it('is an alias of sgfToMoveTree', () => {
    const sgf = '(;SZ[19];B[pd])';
    const a = parseSgfContent(sgf);
    const b = sgfToMoveTree(sgf);
    expect(a!.tree.children[0].move).toBe('Q16');
    expect(b!.tree.children[0].move).toBe('Q16');
    expect(a!.boardSize).toBe(b!.boardSize);
    expect(a!.komi).toBe(b!.komi);
  });
});
