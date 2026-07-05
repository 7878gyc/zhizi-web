import type { MoveNode, AnalysisInfo } from './go-types';

function gtpToSgfCoord(move: string, boardSize: number): string {
  const col = move.charCodeAt(0) - 65; // 'A' = 65
  const row = boardSize - parseInt(move.substring(1), 10);
  const sgfCol = col >= 8 ? col + 1 : col; // skip 'I' (same as GTP)
  return String.fromCharCode(97 + sgfCol) + String.fromCharCode(97 + row);
}

function escapeSgfText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\]/g, '\\]');
}

function formatVisits(visits: number): string {
  if (visits >= 1_000_000) return (visits / 1_000_000).toFixed(1) + 'm';
  if (visits >= 1000) return (visits / 1000).toFixed(1) + 'k';
  return String(visits);
}

function formatLZProperty(
  candidates: AnalysisInfo[],
  winrate: number | null,
  boardSize: number
): string {
  const sorted = [...candidates].sort((a, b) => (a.order || 0) - (b.order || 0));
  const allVisits = sorted.reduce((s, m) => s + m.visits, 0);
  const scoreMean = sorted[0]?.scoreMean ?? 0;
  const scoreStdev = sorted[0]?.scoreStdev ?? 0;

  // Line 1: engine_name winrate visits scoreMean scoreStdev
  const wr = winrate != null ? Math.round(winrate * 100) : 0;
  const line1 = `KataGo ${wr} ${formatVisits(allVisits)} ${scoreMean.toFixed(2)} ${scoreStdev.toFixed(2)}`;

  // Line 2: move candidates
  const moves = sorted.map(m => {
    const coord = gtpToSgfCoord(m.move, boardSize);
    const pv = (m.pv && m.pv.length > 0)
      ? ' pv ' + m.pv.map(c => gtpToSgfCoord(c, boardSize)).join(' ')
      : '';
    return `move ${coord} visits ${m.visits} winrate ${Math.round(m.winrate * 10000)} prior ${Math.round(m.prior * 10000)} scoreMean ${(m.scoreMean ?? 0).toFixed(2)}${pv}`;
  }).join(' info ');

  return `${line1}\n${moves}`;
}

function formatComment(
  candidates: AnalysisInfo[],
  winrate: number | null,
  isBlackMove: boolean
): string {
  if (winrate == null || candidates.length === 0) return '';

  const sorted = [...candidates].sort((a, b) => (a.order || 0) - (b.order || 0));
  const blackWR = isBlackMove ? winrate : (1 - winrate);
  const wrPct = (blackWR * 100).toFixed(1);
  const delta = winrate > 0.5 ? (winrate - 0.5) * 2 : -(0.5 - winrate) * 2;
  const deltaPct = (delta * 100).toFixed(1);
  const deltaSign = delta > 0 ? '+' : '';

  const lead = sorted[0]?.scoreLead ?? sorted[0]?.scoreMean ?? 0;
  const stdev = sorted[0]?.scoreStdev ?? 0;
  const visits = sorted.reduce((s, m) => s + m.visits, 0);

  return [
    `黑 胜率: ${wrPct}% (${deltaSign}${deltaPct}%)`,
    `领先目数 ${lead.toFixed(1)} 标准差 ${stdev.toFixed(1)}`,
    `(KataGo / ${formatVisits(visits)} 计算量)`,
    `贴目 6.5`,
  ].join('\\n');
}

export interface SgfOptions {
  boardSize: number;
  komi: number;
  rules: string;
  moveTree: MoveNode;
  currentPath: string[];
  analysisCache?: Map<number, { data: AnalysisInfo[]; winrate: number | null }>;
  includeAnalysis?: boolean;
  playerBlack?: string;
  playerWhite?: string;
  engineName?: string;
}

export function generateSGF(options: SgfOptions): string {
  const {
    boardSize,
    komi,
    rules,
    moveTree,
    currentPath,
    analysisCache,
    includeAnalysis = false,
    playerBlack = 'Black',
    playerWhite = 'White',
    engineName = 'KataGo',
  } = options;

  const lines: string[] = [];

  // Header
  lines.push('(;');
  lines.push(`GM[1]`);
  lines.push(`FF[4]`);
  lines.push(`CA[UTF-8]`);
  lines.push(`SZ[${boardSize}]`);
  lines.push(`KM[${komi.toFixed(1)}]`);
  lines.push(`RU[${rules}]`);
  lines.push(`PB[${escapeSgfText(playerBlack)}]`);
  lines.push(`PW[${escapeSgfText(playerWhite)}]`);
  lines.push(`DT[${new Date().toISOString().slice(0, 10).replace(/-/g, '-')}]`);

  // Build node lookup from path
  const nodeMap = new Map<string, MoveNode>();
  function indexTree(node: MoveNode) {
    nodeMap.set(node.id, node);
    for (const child of node.children) indexTree(child);
  }
  indexTree(moveTree);

  // Walk the current path and generate nodes
  for (let i = 1; i < currentPath.length; i++) {
    const nodeId = currentPath[i];
    const node = nodeMap.get(nodeId);
    if (!node || !node.move || node.move === 'root') continue;

    const isBlack = node.color === 'black';
    const prefix = isBlack ? 'B' : 'W';
    const coord = gtpToSgfCoord(node.move, boardSize);

    const nodeProps: string[] = [`${prefix}[${coord}]`];

    // Add analysis data if available
    if (includeAnalysis && analysisCache) {
      const cached = analysisCache.get(i);
      if (cached && cached.data.length > 0) {
        const lz = formatLZProperty(cached.data, cached.winrate, boardSize);
        const comment = formatComment(cached.data, cached.winrate, isBlack);
        if (lz) nodeProps.push(`LZ[${escapeSgfText(lz)}]`);
        if (comment) nodeProps.push(`C[${escapeSgfText(comment)}]`);
      }
    }

    lines.push(`;${nodeProps.join('')}`);
  }

  lines.push(')');

  return lines.join('');
}

export function generatePureSGF(options: SgfOptions): string {
  return generateSGF({ ...options, includeAnalysis: false });
}

export function generateAnalyzedSGF(options: SgfOptions): string {
  return generateSGF({ ...options, includeAnalysis: true });
}

export function downloadSgfFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
