'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import type { GoStone, MoveNode } from '@/lib/go-types';
import { coordToGTP, findNode, getPathToNode, generateNodeId, createRootNode, gtpToCoord } from '@/lib/go-types';

interface UseGoGameReturn {
  board: ('black' | 'white' | null)[][];
  boardSize: number;
  komi: number;
  rules: string;
  currentPlayer: 'black' | 'white';
  moveTree: MoveNode;
  currentNodeId: string;
  lastMove: { row: number; col: number } | null;
  gtpMoves: string[];
  totalMoves: number;          // total moves in current path
  currentMoveNumber: number;   // 0-based move number of current node
  winrateHistory: (number | null)[];  // winrate per move along current path
  placeStone: (row: number, col: number) => boolean;
  goToPrevMove: () => void;
  goToNextMove: () => void;
  jumpToNode: (nodeId: string) => void;
  deleteNode: (nodeId: string) => void;
  deleteBranch: (nodeId: string) => void;
  resetBoard: () => void;
  setBoardSize: (size: number) => void;
  setKomi: (komi: number) => void;
  setRules: (rules: string) => void;
  loadFromTree: (tree: MoveNode, targetNodeId?: string) => void;
  setCurrentWinrate: (winrate: number) => void;
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

/** Replay board from a path of move nodes */
function replayBoardFromPath(
  path: MoveNode[],
  boardSize: number
): { board: ('black' | 'white' | null)[][]; nextPlayer: 'black' | 'white' } {
  const board = createEmptyBoard(boardSize);
  let nextPlayer: 'black' | 'white' = 'black';

  // Skip root (index 0)
  for (let i = 1; i < path.length; i++) {
    const node = path[i];
    if (node.move === 'root' || !node.color) continue;

    const { row, col } = gtpToCoord(node.move, boardSize);

    if (row < 0 || row >= boardSize || col < 0 || col >= boardSize) continue;

    board[row][col] = node.color;
    const opponent = node.color === 'black' ? 'white' : 'black';

    // Handle captures
    for (const [nr, nc] of getNeighbors(row, col, boardSize)) {
      if (board[nr][nc] === opponent) {
        const group = getGroup(board, nr, nc, boardSize);
        if (group.liberties === 0) {
          for (const [sr, sc] of group.stones) {
            board[sr][sc] = null;
          }
        }
      }
    }

    nextPlayer = opponent;
  }

  return { board, nextPlayer };
}

/** Remove a node from its parent's children */
function removeNodeFromParent(tree: MoveNode, nodeId: string): MoveNode {
  if (tree.id === nodeId) return tree; // Cannot remove root

  const newChildren: MoveNode[] = [];
  for (const child of tree.children) {
    if (child.id === nodeId) {
      // Skip this child (remove it)
      continue;
    }
    newChildren.push(removeNodeFromParent(child, nodeId));
  }
  return { ...tree, children: newChildren };
}

/** Deep clone a MoveNode tree with updated parentIds */
function cloneTree(node: MoveNode, newParentId: string | null = null): MoveNode {
  return {
    ...node,
    parentId: newParentId,
    children: node.children.map(c => cloneTree(c, node.id)),
  };
}

export function useGoGame(initialSize: number = 19): UseGoGameReturn {
  const [boardSize, setBoardSizeState] = useState(initialSize);
  const [komi, setKomiState] = useState(7.5);
  const [rules, setRulesState] = useState('chinese');
  const [board, setBoard] = useState<('black' | 'white' | null)[][]>(() => createEmptyBoard(initialSize));
  const [currentPlayer, setCurrentPlayer] = useState<'black' | 'white'>('black');
  const [moveTree, setMoveTree] = useState<MoveNode>(() => createRootNode());
  const [currentNodeId, setCurrentNodeId] = useState<string>('root');
  const [lastMove, setLastMove] = useState<{ row: number; col: number } | null>(null);
  const [winrateHistory, setWinrateHistory] = useState<(number | null)[]>([null]);

  /** Navigate to a node and update the board */
  const navigateToNode = useCallback(
    (nodeId: string, tree?: MoveNode) => {
      const targetTree = tree ?? moveTree;
      const path = getPathToNode(targetTree, nodeId);
      if (path.length === 0) return;

      const { board: newBoard, nextPlayer } = replayBoardFromPath(path, boardSize);

      setBoard(newBoard);
      setCurrentPlayer(nextPlayer);
      setCurrentNodeId(nodeId);

      // Update lastMove
      const lastNode = path[path.length - 1];
      if (lastNode.move !== 'root' && lastNode.color) {
        const { row, col } = gtpToCoord(lastNode.move, boardSize);
        setLastMove({ row, col });
      } else {
        setLastMove(null);
      }

      // Update winrate history along the path
      const wrHist = path.map(n => n.winrate ?? null);
      setWinrateHistory(wrHist);
    },
    [moveTree, boardSize]
  );

  const placeStone = useCallback(
    (row: number, col: number): boolean => {
      if (row < 0 || row >= boardSize || col < 0 || col >= boardSize) return false;
      if (board[row][col] !== null) return false;

      // Check if the move is legal (simulate)
      const simBoard = board.map((r) => [...r]);
      const color: 'black' | 'white' = currentPlayer;
      const opponent = color === 'black' ? 'white' : 'black';
      simBoard[row][col] = color;

      const capturedStones: GoStone[] = [];
      for (const [nr, nc] of getNeighbors(row, col, boardSize)) {
        if (simBoard[nr][nc] === opponent) {
          const group = getGroup(simBoard, nr, nc, boardSize);
          if (group.liberties === 0) {
            for (const [sr, sc] of group.stones) {
              capturedStones.push({ row: sr, col: sc, color: opponent });
              simBoard[sr][sc] = null;
            }
          }
        }
      }

      // Check suicide
      const selfGroup = getGroup(simBoard, row, col, boardSize);
      if (selfGroup.liberties === 0 && capturedStones.length === 0) {
        return false;
      }

      const coord = coordToGTP(row, col, boardSize);

      // Check if this move already exists as a child of currentNode
      const currentNode = findNode(moveTree, currentNodeId);
      if (currentNode) {
        const existingChild = currentNode.children.find(c => c.move === coord && c.color === color);
        if (existingChild) {
          // Navigate to existing child
          navigateToNode(existingChild.id);
          return true;
        }
      }

      // Create new node
      const newNode: MoveNode = {
        id: generateNodeId(),
        move: coord,
        color,
        capturedStones: capturedStones.length > 0 ? capturedStones : undefined,
        children: [],
        parentId: currentNodeId,
        moveNumber: currentNode ? currentNode.moveNumber + 1 : 1,
      };

      // Add to tree
      const addNodeToTree = (node: MoveNode): MoveNode => {
        if (node.id === currentNodeId) {
          return { ...node, children: [...node.children, newNode] };
        }
        return { ...node, children: node.children.map(addNodeToTree) };
      };

      const newTree = addNodeToTree(moveTree);
      setMoveTree(newTree);
      navigateToNode(newNode.id, newTree);

      return true;
    },
    [boardSize, board, currentPlayer, moveTree, currentNodeId, navigateToNode]
  );

  const goToPrevMove = useCallback(() => {
    const currentNode = findNode(moveTree, currentNodeId);
    if (!currentNode || !currentNode.parentId) return;
    navigateToNode(currentNode.parentId);
  }, [moveTree, currentNodeId, navigateToNode]);

  const goToNextMove = useCallback(() => {
    const currentNode = findNode(moveTree, currentNodeId);
    if (!currentNode || currentNode.children.length === 0) return;
    // Follow main branch (first child)
    navigateToNode(currentNode.children[0].id);
  }, [moveTree, currentNodeId, navigateToNode]);

  const jumpToNode = useCallback(
    (nodeId: string) => {
      navigateToNode(nodeId);
    },
    [navigateToNode]
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      if (nodeId === 'root') return;

      // Capture parent ID before removing the node
      const deletedNode = findNode(moveTree, nodeId);
      const fallbackParentId = deletedNode?.parentId ?? 'root';

      const newTree = removeNodeFromParent(moveTree, nodeId);
      setMoveTree(newTree);

      // If we deleted the current node or an ancestor, go to parent
      const stillExists = findNode(newTree, currentNodeId);
      if (!stillExists) {
        navigateToNode(fallbackParentId, newTree);
      }
    },
    [moveTree, currentNodeId, navigateToNode]
  );

  const deleteBranch = useCallback(
    (nodeId: string) => {
      // Same as deleteNode - removes the node and all its descendants
      deleteNode(nodeId);
    },
    [deleteNode]
  );

  const resetBoard = useCallback(() => {
    setBoard(createEmptyBoard(boardSize));
    setCurrentPlayer('black');
    setMoveTree(createRootNode());
    setCurrentNodeId('root');
    setLastMove(null);
    setWinrateHistory([null]);
  }, [boardSize]);

  const setBoardSize = useCallback((size: number) => {
    setBoardSizeState(size);
    setBoard(createEmptyBoard(size));
    setCurrentPlayer('black');
    setMoveTree(createRootNode());
    setCurrentNodeId('root');
    setLastMove(null);
    setWinrateHistory([null]);
  }, []);

  const setKomi = useCallback((k: number) => {
    setKomiState(k);
  }, []);

  const setRules = useCallback((r: string) => {
    setRulesState(r);
  }, []);

  const loadFromTree = useCallback(
    (tree: MoveNode, targetNodeId?: string) => {
      const cloned = cloneTree(tree);
      setMoveTree(cloned);
      const target = targetNodeId ?? (() => {
        // Default: go to the last node on the main branch
        let node = cloned;
        while (node.children.length > 0) {
          node = node.children[0];
        }
        return node.id;
      })();
      navigateToNode(target, cloned);
    },
    [navigateToNode]
  );

  // Stable refs so setCurrentWinrate never changes reference
  const moveTreeRef = useRef(moveTree);
  moveTreeRef.current = moveTree;
  const currentNodeIdRef = useRef(currentNodeId);
  currentNodeIdRef.current = currentNodeId;

  const setCurrentWinrate = useCallback(
    (winrate: number) => {
      const tree = moveTreeRef.current;
      const nodeId = currentNodeIdRef.current;

      const currentNode = findNode(tree, nodeId);

      // Guard: skip if node not found (abnormal scenario) or is root node
      if (!currentNode || currentNode.move === 'root') return;

      // Convert to Black's perspective: engine reports winrate from the
      // CURRENT player's view. If Black just moved (color='black'),
      // current player is White → flip to 1 - winrate.
      const blackWinrate = currentNode.color === 'black' ? 1 - winrate : winrate;

      // Skip if the same value is already stored
      if (currentNode.winrate === blackWinrate) return;

      const updateWinrate = (node: MoveNode): MoveNode => {
        if (node.id === nodeId) {
          return { ...node, winrate: blackWinrate };
        }
        return { ...node, children: node.children.map(updateWinrate) };
      };
      const newTree = updateWinrate(tree);

      setMoveTree(newTree);

      setWinrateHistory(prev => {
        const next = [...prev];
        next[next.length - 1] = blackWinrate;
        return next;
      });
    },
    [] // stable!
  );

  // Build GTP moves array from current path (stable reference via useMemo)
  const currentPath = useMemo(() => getPathToNode(moveTree, currentNodeId), [moveTree, currentNodeId]);
  const gtpMoves = useMemo(
    () =>
      currentPath
        .filter(n => n.move !== 'root' && n.color)
        .map(m => `${m.color === 'black' ? 'B' : 'W'} ${m.move}`),
    [currentPath]
  );

  const totalMoves = gtpMoves.length;
  const currentMoveNumber = currentPath.length - 1; // 0-based (root=0)

  return {
    board,
    boardSize,
    komi,
    rules,
    currentPlayer,
    moveTree,
    currentNodeId,
    lastMove,
    gtpMoves,
    totalMoves,
    currentMoveNumber,
    winrateHistory,
    placeStone,
    goToPrevMove,
    goToNextMove,
    jumpToNode,
    deleteNode,
    deleteBranch,
    resetBoard,
    setBoardSize,
    setKomi,
    setRules,
    loadFromTree,
    setCurrentWinrate,
  };
}
