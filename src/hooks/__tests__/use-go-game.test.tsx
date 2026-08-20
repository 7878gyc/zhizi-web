import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGoGame } from '@/hooks/use-go-game';
import type { MoveNode } from '@/lib/go-types';

/** Play a move in an isolated act() so the hook's closures stay fresh. */
function play(result: { current: ReturnType<typeof useGoGame> }, row: number, col: number) {
  let ok = false;
  act(() => {
    ok = result.current.placeStone(row, col);
  });
  return ok;
}

describe('useGoGame', () => {
  it('starts with an empty board and black to move', () => {
    const { result } = renderHook(() => useGoGame(19));
    expect(result.current.board).toHaveLength(19);
    expect(result.current.board.every(row => row.every(c => c === null))).toBe(true);
    expect(result.current.currentPlayer).toBe('black');
    expect(result.current.currentNodeId).toBe('root');
    expect(result.current.totalMoves).toBe(0);
    expect(result.current.gtpMoves).toEqual([]);
    expect(result.current.currentMoveNumber).toBe(0);
  });

  it('places a stone and switches the player', () => {
    const { result } = renderHook(() => useGoGame(19));
    expect(play(result, 3, 15)).toBe(true);
    expect(result.current.board[3][15]).toBe('black');
    expect(result.current.currentPlayer).toBe('white');
    expect(result.current.totalMoves).toBe(1);
    expect(result.current.gtpMoves).toEqual(['B Q16']);
    expect(result.current.lastMove).toEqual({ row: 3, col: 15 });
  });

  it('rejects out-of-bounds moves', () => {
    const { result } = renderHook(() => useGoGame(19));
    expect(play(result, -1, 0)).toBe(false);
    expect(play(result, 19, 0)).toBe(false);
    expect(play(result, 0, 19)).toBe(false);
    expect(result.current.totalMoves).toBe(0);
  });

  it('rejects moves on an occupied intersection', () => {
    const { result } = renderHook(() => useGoGame(19));
    expect(play(result, 3, 15)).toBe(true);
    expect(play(result, 3, 15)).toBe(false);
    expect(result.current.totalMoves).toBe(1);
  });

  it('rejects suicide moves', () => {
    const { result } = renderHook(() => useGoGame(19));
    // Black corner stone at (0,0)
    play(result, 0, 0);
    play(result, 0, 1); // W
    play(result, 2, 2); // B elsewhere
    play(result, 1, 0); // W captures (0,0) - it is now empty

    // Black tries to re-play (0,0): surrounded by white, no captures → suicide
    play(result, 2, 3); // B elsewhere
    play(result, 1, 3); // W elsewhere
    expect(play(result, 0, 0)).toBe(false);
    expect(result.current.board[0][0]).toBeNull();
  });

  it('captures opponent groups with no liberties', () => {
    const { result } = renderHook(() => useGoGame(19));
    play(result, 8, 9); // B
    play(result, 9, 9); // W (center stone)
    play(result, 10, 9); // B
    play(result, 8, 8); // W elsewhere
    play(result, 9, 8); // B (left liberty)
    play(result, 16, 16); // W elsewhere
    play(result, 9, 10); // B (right liberty → captures)

    expect(result.current.board[9][9]).toBeNull();
    // Traverse the main branch to the 7th node: B(9,10) = L10
    let node = result.current.moveTree.children[0];
    for (let i = 0; i < 6; i++) node = node.children[0];
    expect(node.move).toBe('L10');
    expect(node.capturedStones).toEqual([{ row: 9, col: 9, color: 'white' }]);
  });

  it('goes back and forward through the move history', () => {
    const { result } = renderHook(() => useGoGame(19));
    play(result, 3, 15); // B Q16
    play(result, 3, 3); // W D4
    play(result, 16, 15); // B Q3

    expect(result.current.totalMoves).toBe(3);

    act(() => result.current.goToPrevMove());
    expect(result.current.totalMoves).toBe(2);
    expect(result.current.currentMoveNumber).toBe(2);
    expect(result.current.board[3][3]).toBe('white');
    expect(result.current.board[16][15]).toBeNull();

    act(() => result.current.goToNextMove());
    expect(result.current.totalMoves).toBe(3);
    expect(result.current.board[16][15]).toBe('black');
  });

  it('reusing a visited move navigates instead of creating a duplicate', () => {
    const { result } = renderHook(() => useGoGame(19));
    play(result, 3, 15); // B Q16
    play(result, 15, 3); // W D4
    act(() => result.current.goToPrevMove());
    play(result, 16, 15); // B alternative branch (Q3)

    // The alternative branch is a sibling of D4
    const children = result.current.moveTree.children[0].children;
    expect(children).toHaveLength(2);
    expect(children.map(c => c.move)).toEqual(['D4', 'Q3']);
  });

  it('deletes a node and its descendants', () => {
    const { result } = renderHook(() => useGoGame(19));
    play(result, 3, 15);
    play(result, 3, 3);
    const n1 = result.current.moveTree.children[0];
    act(() => result.current.deleteNode(n1.id));

    expect(result.current.totalMoves).toBe(0);
    expect(result.current.moveTree.children).toHaveLength(0);
    expect(result.current.currentNodeId).toBe('root');
  });

  it('loads a tree and navigates to the last main-branch node', () => {
    const tree: MoveNode = {
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
    const { result } = renderHook(() => useGoGame(19));
    act(() => result.current.loadFromTree(tree));

    expect(result.current.gtpMoves).toEqual(['B Q16', 'W D4']);
    expect(result.current.board[3][15]).toBe('black');
    expect(result.current.board[15][3]).toBe('white');
  });

  it('resets the board back to the initial state', () => {
    const { result } = renderHook(() => useGoGame(19));
    play(result, 3, 15);
    play(result, 3, 3);
    act(() => result.current.resetBoard());

    expect(result.current.totalMoves).toBe(0);
    expect(result.current.currentPlayer).toBe('black');
    expect(result.current.currentNodeId).toBe('root');
    expect(result.current.board.every(row => row.every(c => c === null))).toBe(true);
  });

  it('changes the board size and resets state', () => {
    const { result } = renderHook(() => useGoGame(19));
    play(result, 3, 15);
    act(() => result.current.setBoardSize(9));

    expect(result.current.boardSize).toBe(9);
    expect(result.current.board).toHaveLength(9);
    expect(result.current.totalMoves).toBe(0);
    expect(result.current.currentPlayer).toBe('black');
  });

  it('records winrates on the current node (black perspective)', () => {
    const { result } = renderHook(() => useGoGame(19));
    play(result, 3, 15); // B Q16 — current node is black

    // Engine reports winrate from the current player's (white) view = 0.7
    // Stored winrate is black's perspective → 1 - 0.7 = 0.3
    act(() => result.current.setCurrentWinrate(0.7));
    expect(result.current.winrateHistory[1]).toBeCloseTo(0.3);
    expect(result.current.moveTree.children[0].winrate).toBeCloseTo(0.3);

    // Skipped when the value is unchanged
    act(() => result.current.setCurrentWinrate(0.7));
    expect(result.current.winrateHistory[1]).toBeCloseTo(0.3);

    // A white node keeps the value as-is (engine already reports black winrate)
    play(result, 15, 3); // W D4
    act(() => result.current.setCurrentWinrate(0.4));
    expect(result.current.winrateHistory[0]).toBeNull();
    expect(result.current.winrateHistory[1]).toBeCloseTo(0.3);
    expect(result.current.winrateHistory[2]).toBeCloseTo(0.4);
  });

  it('ignores setCurrentWinrate on the root node', () => {
    const { result } = renderHook(() => useGoGame(19));
    act(() => result.current.setCurrentWinrate(0.9));
    expect(result.current.winrateHistory).toEqual([null]);
  });
});
