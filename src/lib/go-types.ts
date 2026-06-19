export interface GoStone {
  row: number;
  col: number;
  color: 'black' | 'white';
}

export interface MoveRecord {
  index: number;
  color: 'black' | 'white';
  coord: string; // e.g. "D4"
  capturedStones?: GoStone[];
}

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
  moveHistory: MoveRecord[];
  board: ('black' | 'white' | null)[][]; 
}

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
    label: 'KataGo TENSORRT 28B (1x GPU)',
  },
  {
    platform: 'all',
    engineType: 'go',
    gpuType: '2x',
    kataName: 'katago-TENSORRT',
    kataWeight: '28bnbt',
    label: 'KataGo TENSORRT 28B (2x GPU)',
  },
  {
    platform: 'all',
    engineType: 'go',
    gpuType: '1x',
    kataName: 'katago-OPENCL',
    kataWeight: '18b',
    label: 'KataGo OPENCL 18B (1x GPU)',
  },
  {
    platform: 'all',
    engineType: 'go',
    gpuType: '1x',
    kataName: 'katago-TENSORRT',
    kataWeight: '40b',
    label: 'KataGo TENSORRT 40B (1x GPU)',
  },
  {
    platform: 'all',
    engineType: 'go',
    gpuType: '4x',
    kataName: 'katago-TENSORRT',
    kataWeight: '40b',
    label: 'KataGo TENSORRT 40B (4x GPU)',
  },
];

export function buildArgsString(config: AiConfig): string {
  return `--platform ${config.platform} --engine-type ${config.engineType} --gpu-type ${config.gpuType} --kata-name ${config.kataName} --kata-weight ${config.kataWeight}`;
}

// Coordinate conversion
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

// Parse kata-analyze output line
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
        info.winrate = parseFloat(val) / 100;
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
        // pv is followed by multiple moves until next key
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
