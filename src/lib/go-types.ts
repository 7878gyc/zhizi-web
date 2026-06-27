export interface GoStone {
  row: number;
  col: number;
  color: 'black' | 'white';
}

// --- Move Tree Data Structure ---

export interface MoveNode {
  id: string;
  move: string;            // GTP坐标 如 "Q16"，根节点为 "root"
  color: 'black' | 'white' | null; // 根节点为null
  capturedStones?: GoStone[];
  winrate?: number;        // 该手分析后的胜率（黑方视角 0-1）
  children: MoveNode[];    // 子分支（从左到右，第一个为主分支）
  parentId: string | null;
  moveNumber: number;      // 手数，根节点为0
}

// --- Analysis ---

export interface AnalysisInfo {
  move: string;       // e.g. "Q16"
  winrate: number;    // 0-1
  scoreMean: number;
  scoreStdev: number;
  visits: number;
  prior: number;      // 0-1
  order: number;
  pv?: string[];      // principal variation
}

export interface GameState {
  boardSize: number;
  komi: number;
  rules: string;
  currentPlayer: 'black' | 'white';
  stones: GoStone[];
  board: ('black' | 'white' | null)[][];
}

// --- AI Config ---

export interface AiConfig {
  platform: string;
  engineType: string;
  gpuType: string;
  kataName: string;
  kataWeight: string;
  label: string;
}

export const AI_CONFIGS: AiConfig[] = [
  {
    platform: 'all',
    engineType: 'go',
    gpuType: '1x',
    kataName: 'katago-TENSORRT',
    kataWeight: '28bnbt',
    label: 'TENSORRT 28B (1x GPU)',
  },
  {
    platform: 'all',
    engineType: 'go',
    gpuType: '2x',
    kataName: 'katago-TENSORRT',
    kataWeight: '28bnbt',
    label: 'TENSORRT 28B (2x GPU)',
  },
  {
    platform: 'all',
    engineType: 'go',
    gpuType: '3x',
    kataName: 'katago-TENSORRT',
    kataWeight: '28bnbt',
    label: 'TENSORRT 28B (3x GPU)',
  },
  {
    platform: 'all',
    engineType: 'go',
    gpuType: '4x',
    kataName: 'katago-TENSORRT',
    kataWeight: '28bnbt',
    label: 'TENSORRT 28B (4x GPU)',
  },
  {
    platform: 'all',
    engineType: 'go',
    gpuType: 'shared',
    kataName: 'katago-TENSORRT',
    kataWeight: '28bnbt',
    label: 'TENSORRT 28B (会员共享)',
  },
];

export function buildArgsString(config: AiConfig): string {
  return `--platform ${config.platform} --engine-type ${config.engineType} --gpu-type ${config.gpuType} --kata-name ${config.kataName} --kata-weight ${config.kataWeight}`;
}

// --- Coordinate conversion ---
const COL_LETTERS = 'ABCDEFGHJKLMNOPQRST'; // Skip 'I'

export function coordToGTP(row: number, col: number, boardSize: number = 19): string {
  const letter = COL_LETTERS[col];
  const number = boardSize - row;
  return `${letter}${number}`;
}

export function gtpToCoord(gtp: string, boardSize: number = 19): { row: number; col: number } {
  const letter = gtp[0].toUpperCase();
  const number = parseInt(gtp.slice(1), 10);
  const col = COL_LETTERS.indexOf(letter);
  const row = boardSize - number;
  return { row, col };
}

// --- SGF coordinate conversion ---
export function sgfToCoord(sgf: string, boardSize: number = 19): { row: number; col: number } {
  // SGF: 'a' = 0, 'b' = 1, ... skip 'i', 's' = 18
  const col = sgf.charCodeAt(0) - 'a'.charCodeAt(0);
  const row = sgf.charCodeAt(1) - 'a'.charCodeAt(0);
  // Convert to our coordinate system (row 0 = top)
  return { row, col };
}

export function coordToSgf(row: number, col: number): string {
  const colChar = String.fromCharCode('a'.charCodeAt(0) + col);
  const rowChar = String.fromCharCode('a'.charCodeAt(0) + row);
  return `${colChar}${rowChar}`;
}

export function sgfToGTP(sgf: string, boardSize: number = 19): string {
  const { row, col } = sgfToCoord(sgf, boardSize);
  return coordToGTP(row, col, boardSize);
}

// --- Parse kata-analyze output line ---
export function parseAnalysisLine(line: string): AnalysisInfo | null {
  if (!line.startsWith('info ')) return null;

  const parts = line.slice(5).trim().split(/\s+/);
  const info: Partial<AnalysisInfo> = {};

  let i = 0;
  while (i < parts.length) {
    const key = parts[i];
    const val = parts[i + 1];

    switch (key) {
      case 'move':
        info.move = val;
        i += 2;
        break;
      case 'winrate':
        info.winrate = parseFloat(val);
        i += 2;
        break;
      case 'scoreMean':
        info.scoreMean = parseFloat(val);
        i += 2;
        break;
      case 'scoreStdev':
        info.scoreStdev = parseFloat(val);
        i += 2;
        break;
      case 'visits':
        info.visits = parseInt(val, 10);
        i += 2;
        break;
      case 'prior':
        info.prior = parseFloat(val);
        i += 2;
        break;
      case 'order':
        info.order = parseInt(val, 10);
        i += 2;
        break;
      case 'pv':
        const pvMoves: string[] = [];
        i += 1;
        while (i < parts.length && !['move', 'winrate', 'scoreMean', 'scoreStdev', 'visits', 'prior', 'order'].includes(parts[i])) {
          pvMoves.push(parts[i]);
          i += 1;
        }
        info.pv = pvMoves;
        break;
      default:
        i += 1;
        break;
    }
  }

  if (info.move !== undefined) {
    return info as AnalysisInfo;
  }
  return null;
}

// --- Move Tree utilities ---

/** Find a node by id in the tree */
export function findNode(root: MoveNode, id: string): MoveNode | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

/** Get the path from root to a specific node */
export function getPathToNode(root: MoveNode, targetId: string): MoveNode[] {
  const path: MoveNode[] = [root];
  if (root.id === targetId) return path;

  for (const child of root.children) {
    const childPath = getPathToNode(child, targetId);
    if (childPath.length > 0) {
      return [...path, ...childPath];
    }
  }
  return [];
}

/** Generate a unique ID for a new node */
export function generateNodeId(): string {
  return `node_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/** Create the root MoveNode (empty board) */
export function createRootNode(): MoveNode {
  return {
    id: 'root',
    move: 'root',
    color: null,
    children: [],
    parentId: null,
    moveNumber: 0,
  };
}
