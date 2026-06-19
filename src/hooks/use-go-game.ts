'use client';

import { useState, useCallback } from 'react';
import type { GoStone, MoveRecord } from '@/lib/go-types';
import { coordToGTP } from '@/lib/go-types';

interface UseGoGameReturn {
  board: ('black' | 'white' | null)[][];
  boardSize: number;
  komi: number;
  rules: string;
  currentPlayer: 'black' | 'white';
  moveHistory: MoveRecord[];
  lastMove: { row: number; col: number } | null;
  gtpMoves: string[]; // GTP format moves for sync
  placeStone: (row: number, col: number) => boolean;
  undoMove: () => void;
  resetBoard: () => void;
  setBoardSize: (size: number) => void;
  setKomi: (komi: number) => void;
  setRules: (rules: string) => void;
  jumpToMove: (index: number) => void;
}

function createEmptyBoard(size: number): ('black' | 'white' | null)[][] {
  return Array.from({ length: size }, () => Array(size).fill(null));
}

function getNeighbors(row: number, col: number, size: number): [number, number][] {
  const neighbors: [number, number][] = [];
  if (row > 0) neighbors.push([row - 1, col]);
  if (row < size - 1) neighbors.push([row + 1, col]);
  if (col > 0) neighbors.push([row, col - 1]);
  if (col < size - 1) neighbors.push([row, col + 1]);
  return neighbors;
}

function getGroup(
  board: ('black' | 'white' | null)[][],
  row: number,
  col: number,
  size: number
): { stones: [number, number][]; liberties: number } {
  const color = board[row][col];
  if (!color) return { stones: [], liberties: 0 };

  const visited = new Set<string>();
  const stones: [number, number][] = [];
  const libertySet = new Set<string>();
  const stack: [number, number][] = [[row, col]];

  while (stack.length > 0) {
    const [r, c] = stack.pop()!;
    const key = `${r},${c}`;
    if (visited.has(key)) continue;
    visited.add(key);

    if (board[r][c] === color) {
      stones.push([r, c]);
      for (const [nr, nc] of getNeighbors(r, c, size)) {
        if (!visited.has(`${nr},${nc}`)) {
          if (board[nr][nc] === null) {
            libertySet.add(`${nr},${nc}`);
          } else if (board[nr][nc] === color) {
            stack.push([nr, nc]);
          }
        }
      }
    }
  }

  return { stones, liberties: libertySet.size };
}

export function useGoGame(initialSize: number = 19): UseGoGameReturn {
  const [boardSize, setBoardSizeState] = useState(initialSize);
  const [komi, setKomiState] = useState(6.5);
  const [rules, setRulesState] = useState('chinese');
  const [board, setBoard] = useState<('black' | 'white' | null)[][]>(() => createEmptyBoard(initialSize));
  const [currentPlayer, setCurrentPlayer] = useState<'black' | 'white'>('black');
  const [moveHistory, setMoveHistory] = useState<MoveRecord[]>([]);
  const [lastMove, setLastMove] = useState<{ row: number; col: number } | null>(null);

  const placeStone = useCallback(
    (row: number, col: number): boolean => {
      if (row < 0 || row >= boardSize || col < 0 || col >= boardSize) return false;

      setBoard((prevBoard) => {
        if (prevBoard[row][col] !== null) return prevBoard;

        const newBoard = prevBoard.map((r) => [...r]);
        const color: 'black' | 'white' = currentPlayer;
        const opponent = color === 'black' ? 'white' : 'black';

        newBoard[row][col] = color;

        // Check for captures
        const capturedStones: GoStone[] = [];
        for (const [nr, nc] of getNeighbors(row, col, boardSize)) {
          if (newBoard[nr][nc] === opponent) {
            const group = getGroup(newBoard, nr, nc, boardSize);
            if (group.liberties === 0) {
              for (const [sr, sc] of group.stones) {
                capturedStones.push({ row: sr, col: sc, color: opponent });
                newBoard[sr][sc] = null;
              }
            }
          }
        }

        // Check for suicide (illegal move)
        const selfGroup = getGroup(newBoard, row, col, boardSize);
        if (selfGroup.liberties === 0 && capturedStones.length === 0) {
          return prevBoard; // Revert - suicide not allowed
        }

        // Valid move - update state via side effects
        const coord = coordToGTP(row, col, boardSize);
        setMoveHistory((prev) => [
          ...prev,
          {
            index: prev.length + 1,
            color,
            coord,
            capturedStones: capturedStones.length > 0 ? capturedStones : undefined,
          },
        ]);
        setLastMove({ row, col });
        setCurrentPlayer(opponent);

        return newBoard;
      });

      return true;
    },
    [boardSize, currentPlayer]
  );

  const undoMove = useCallback(() => {
    if (moveHistory.length === 0) return;

    const lastMoveRecord = moveHistory[moveHistory.length - 1];

    setBoard((prevBoard) => {
      const newBoard = prevBoard.map((r) => [...r]);

      // Remove the last stone
      const { row, col } = (() => {
        const COL_LETTERS = 'ABCDEFGHJKLMNOPQRST';
        const letter = lastMoveRecord.coord[0].toUpperCase();
        const number = parseInt(lastMoveRecord.coord.slice(1), 10);
        return { row: boardSize - number, col: COL_LETTERS.indexOf(letter) };
      })();
      newBoard[row][col] = null;

      // Restore captured stones
      if (lastMoveRecord.capturedStones) {
        for (const stone of lastMoveRecord.capturedStones) {
          newBoard[stone.row][stone.col] = stone.color;
        }
      }

      return newBoard;
    });

    setMoveHistory((prev) => prev.slice(0, -1));
    setCurrentPlayer((prev) => (prev === 'black' ? 'white' : 'black'));
    setLastMove(() => {
      if (moveHistory.length > 1) {
        const prevMove = moveHistory[moveHistory.length - 2];
        const COL_LETTERS = 'ABCDEFGHJKLMNOPQRST';
        const letter = prevMove.coord[0].toUpperCase();
        const number = parseInt(prevMove.coord.slice(1), 10);
        return { row: boardSize - number, col: COL_LETTERS.indexOf(letter) };
      }
      return null;
    });
  }, [moveHistory, boardSize]);

  const resetBoard = useCallback(() => {
    setBoard(createEmptyBoard(boardSize));
    setCurrentPlayer('black');
    setMoveHistory([]);
    setLastMove(null);
  }, [boardSize]);

  const setBoardSize = useCallback((size: number) => {
    setBoardSizeState(size);
    setBoard(createEmptyBoard(size));
    setCurrentPlayer('black');
    setMoveHistory([]);
    setLastMove(null);
  }, []);

  const setKomi = useCallback((k: number) => {
    setKomiState(k);
  }, []);

  const setRules = useCallback((r: string) => {
    setRulesState(r);
  }, []);

  const jumpToMove = useCallback(
    (targetIndex: number) => {
      // Replay moves up to targetIndex
      const newBoard = createEmptyBoard(boardSize);
      let player: 'black' | 'white' = 'black';

      for (let i = 0; i <= targetIndex && i < moveHistory.length; i++) {
        const move = moveHistory[i];
        const COL_LETTERS = 'ABCDEFGHJKLMNOPQRST';
        const letter = move.coord[0].toUpperCase();
        const number = parseInt(move.coord.slice(1), 10);
        const row = boardSize - number;
        const col = COL_LETTERS.indexOf(letter);

        if (row >= 0 && row < boardSize && col >= 0 && col < boardSize) {
          newBoard[row][col] = move.color;

          // Handle captures for this move
          const opponent = move.color === 'black' ? 'white' : 'black';
          for (const [nr, nc] of getNeighbors(row, col, boardSize)) {
            if (newBoard[nr][nc] === opponent) {
              const group = getGroup(newBoard, nr, nc, boardSize);
              if (group.liberties === 0) {
                for (const [sr, sc] of group.stones) {
                  newBoard[sr][sc] = null;
                }
              }
            }
          }
        }

        player = move.color === 'black' ? 'white' : 'black';
      }

      setBoard(newBoard);
      setCurrentPlayer(player);

      // Truncate move history
      const targetMove = moveHistory[targetIndex];
      if (targetMove) {
        const COL_LETTERS = 'ABCDEFGHJKLMNOPQRST';
        const letter = targetMove.coord[0].toUpperCase();
        const number = parseInt(targetMove.coord.slice(1), 10);
        setLastMove({ row: boardSize - number, col: COL_LETTERS.indexOf(letter) });
      }

      setMoveHistory((prev) => prev.slice(0, targetIndex + 1));
    },
    [boardSize, moveHistory]
  );

  // Build GTP moves array from history
  const gtpMoves = moveHistory.map(
    (m) => `${m.color === 'black' ? 'B' : 'W'} ${m.coord}`
  );

  return {
    board,
    boardSize,
    komi,
    rules,
    currentPlayer,
    moveHistory,
    lastMove,
    gtpMoves,
    placeStone,
    undoMove,
    resetBoard,
    setBoardSize,
    setKomi,
    setRules,
    jumpToMove,
  };
}
