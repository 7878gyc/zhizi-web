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
  scoreLead?: number;
  visits: number;
  prior: number;      // 0-1
  order: number;
  pv?: string[];      // principal variation
  speed?: number;     // visits per second
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

// GPU types available
export const GPU_TYPES = [
  { value: '1x', label: '1x GPU' },
  { value: '2x', label: '2x GPU' },
  { value: '3x', label: '3x GPU' },
  { value: '4x', label: '4x GPU' },
  { value: 'shared', label: 'VIP共享' },
];

// Weights available
export const WEIGHTS = [
  { value: '18b', label: '18b (轻量)' },
  { value: '28bnbt', label: '28b (标准)' },
  { value: 'fdx', label: 'fdx (最强)' },
];

// Generate all combinations
export const AI_CONFIGS: AiConfig[] = GPU_TYPES.flatMap(gpu =>
  WEIGHTS.map(weight => ({
    platform: 'all',
    engineType: 'go',
    gpuType: gpu.value,
    kataName: 'katago-TENSORRT',
    kataWeight: weight.value,
    label: `${weight.label} ${gpu.label}`,
  }))
);

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

// --- Parse kata-analyze / lz-analyze output ---

const SCALAR_KEYS = new Set([
  'move',
  'visits',
  'edgeVisits',
  'utility',
  'winrate',
  'scoreMean',
  'scoreStdev',
  'scoreLead',
  'scoreSelfplay',
  'prior',
  'lcb',
  'utilityLcb',
  'weight',
  'order',
]);

const NUMERIC_INT_KEYS = new Set(['visits', 'edgeVisits', 'order']);

/** Parse a single "info ..." block (without the leading "info ")。*/
function parseInfoBlock(block: string): Partial<AnalysisInfo> {
  const tokens = block.trim().split(/\s+/).filter(Boolean);
  const info: Record<string, string | number | string[]> = {};
  let i = 0;
  while (i < tokens.length) {
    const key = tokens[i];
    if (key === 'pv') {
      info.pv = tokens.slice(i + 1);
      break;
    }
    if (!SCALAR_KEYS.has(key)) {
      // Unknown key; stop parsing this block
      break;
    }
    const val = tokens[i + 1];
    if (val === undefined) break;
    if (NUMERIC_INT_KEYS.has(key)) info[key] = parseInt(val, 10);
    else if (key === 'move') info[key] = val;
    else info[key] = parseFloat(val);
    i += 2;
  }
  return info;
}

/** Parse one or more concatenated info blocks from a line。*/
export function parseInfoLine(line: string): AnalysisInfo[] {
  // Split before each standalone lowercase "info" token
  const segments = line.split(/(?=\binfo\s)/);
  const candidates: AnalysisInfo[] = [];
  for (const seg of segments) {
    const trimmed = seg.trim();
    if (!trimmed.startsWith('info ')) continue;
    const block = trimmed.slice('info '.length);
    const info = parseInfoBlock(block);
    if (info.move) {
      const result = info as AnalysisInfo;
      result.winrate = result.winrate > 1 ? result.winrate / 10000 : result.winrate;
      result.prior = result.prior > 1 ? result.prior / 10000 : result.prior;
      candidates.push(result);
    }
  }
  return candidates;
}

export function parseAnalysisLine(line: string): AnalysisInfo | null {
  // Legacy compatibility: callers that still use this single-result API
  // get the first candidate only; new code should use parseInfoLine directly.
  const candidates = parseInfoLine(line);
  return candidates.length > 0 ? candidates[0] : null;
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
