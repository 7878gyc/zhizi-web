import type { MoveNode, AnalysisInfo, AnalysisCache } from './go-types';

const GTP_COL_LETTERS = 'ABCDEFGHJKLMNOPQRST';

function gtpToSgfCoord(move: string, boardSize: number): string {
  if (typeof move !== 'string' || move.length < 2) return '';
  const colBoard = GTP_COL_LETTERS.indexOf(move[0].toUpperCase());
  const rowBoard = boardSize - parseInt(move.substring(1), 10);
  if (colBoard < 0 || colBoard >= boardSize) return '';
  if (!Number.isFinite(rowBoard) || rowBoard < 0 || rowBoard >= boardSize) return '';
  return String.fromCharCode(97 + colBoard) + String.fromCharCode(97 + rowBoard);
}

export function sgfToGtpCoord(coord: string, boardSize: number): string {
  if (typeof coord !== 'string' || coord.length < 2) return '';
  const colBoard = coord.charCodeAt(0) - 97;
  const rowBoard = coord.charCodeAt(1) - 97;
  const col = GTP_COL_LETTERS[colBoard];
  if (!col || colBoard >= boardSize) return '';
  if (rowBoard < 0 || rowBoard >= boardSize) return '';
  return col + (boardSize - rowBoard);
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

  const wr = winrate != null ? Math.round(winrate * 100) : 0;
  const line1 = `KataGo ${wr} ${formatVisits(allVisits)} ${scoreMean.toFixed(2)} ${scoreStdev.toFixed(2)}`;

  const moves = sorted.map(m => {
    const coord = gtpToSgfCoord(m.move, boardSize);
    const pv = (m.pv && m.pv.length > 0)
      ? ' pv ' + m.pv.map(c => gtpToSgfCoord(c, boardSize)).filter(Boolean).join(' ')
      : '';
    return `move ${coord} visits ${m.visits} winrate ${Math.round(m.winrate * 10000)} prior ${Math.round(m.prior * 10000)} scoreMean ${(m.scoreMean ?? 0).toFixed(2)}${pv}`;
  }).join(' info ');

  return `${line1}\\n${moves}`;
}

function formatComment(
  candidates: AnalysisInfo[],
  winrate: number | null,
  isBlackMove: boolean,
  komi: number,
): string {
  if (winrate == null || candidates.length === 0) return '';

  const sorted = [...candidates].sort((a, b) => (a.order || 0) - (b.order || 0));
  const blackWR = isBlackMove ? (1 - winrate) : winrate;
  const wrPct = (blackWR * 100).toFixed(1);
  const delta = blackWR > 0.5 ? (blackWR - 0.5) * 2 : -(0.5 - blackWR) * 2;
  const deltaPct = (delta * 100).toFixed(1);
  const deltaSign = delta > 0 ? '+' : '';

  const lead = sorted[0]?.scoreLead ?? sorted[0]?.scoreMean ?? 0;
  const stdev = sorted[0]?.scoreStdev ?? 0;
  const visits = sorted.reduce((s, m) => s + m.visits, 0);

  return [
    `黑 胜率: ${wrPct}% (${deltaSign}${deltaPct}%)`,
    `领先目数 ${lead.toFixed(1)} 标准差 ${stdev.toFixed(1)}`,
    `(KataGo / ${formatVisits(visits)} 计算量)`,
    `贴目 ${komi.toFixed(1)}`,
  ].join('\\n');
}

export interface SgfOptions {
  boardSize: number;
  komi: number;
  rules: string;
  moveTree: MoveNode;
  analysisCache?: AnalysisCache;
  includeAnalysis?: boolean;
  playerBlack?: string;
  playerWhite?: string;
}

export function generateSGF(options: SgfOptions): string {
  const {
    boardSize,
    komi,
    rules,
    moveTree,
    analysisCache,
    includeAnalysis = false,
    playerBlack = 'Black',
    playerWhite = 'White',
  } = options;

  const rootProps: string[] = [
    'GM[1]',
    'FF[4]',
    'CA[UTF-8]',
    `SZ[${boardSize}]`,
    `KM[${komi}]`,
    `RU[${escapeSgfText(rules)}]`,
    `PB[${escapeSgfText(playerBlack)}]`,
    `PW[${escapeSgfText(playerWhite)}]`,
    `DT[${new Date().toISOString().slice(0, 10)}]`,
  ];

  // 让子 / 加子：不写回 AB/AW 会让导入的让子棋在保存后丢掉预置子。
  const handicap = moveTree.handicapStones ?? [];
  const ab = handicap
    .filter(s => s.color === 'black')
    .map(s => gtpToSgfCoord(s.move, boardSize))
    .filter(Boolean);
  const aw = handicap
    .filter(s => s.color === 'white')
    .map(s => gtpToSgfCoord(s.move, boardSize))
    .filter(Boolean);
  if (ab.length > 0) rootProps.push(`AB${ab.map(c => `[${c}]`).join('')}`);
  if (aw.length > 0) rootProps.push(`AW${aw.map(c => `[${c}]`).join('')}`);

  const serializeNode = (node: MoveNode): string => {
    if (!node.move || node.move === 'root' || !node.color) return '';

    const coord = gtpToSgfCoord(node.move, boardSize);
    const props: string[] = [`${node.color === 'black' ? 'B' : 'W'}[${coord}]`];

    if (includeAnalysis && analysisCache) {
      const cached = analysisCache.get(node.id);
      if (cached && cached.data.length > 0) {
        const lz = formatLZProperty(cached.data, cached.winrate, boardSize);
        const comment = formatComment(cached.data, cached.winrate, node.color === 'black', komi);
        if (lz) props.push(`LZ[${escapeSgfText(lz)}]`);
        if (comment) props.push(`C[${escapeSgfText(comment)}]`);
      }
    }

    let text = `;${props.join('')}`;
    const children = node.children.map(serializeNode).filter(Boolean);
    if (children.length === 1) {
      text += children[0];
    } else if (children.length > 1) {
      // 有多个分支时，所有分支都必须用括号包起来；否则第二个分支会被
      // SGF 解析器理解成第一个分支后续节点的变体。
      for (const child of children) {
        text += `(${child})`;
      }
    }
    return text;
  };

  const serializedChildren = moveTree.children.map(serializeNode).filter(Boolean);
  let out = `(;${rootProps.join('')}`;
  if (serializedChildren.length === 1) {
    out += serializedChildren[0];
  } else if (serializedChildren.length > 1) {
    for (const child of serializedChildren) {
      out += `(${child})`;
    }
  }
  out += ')';
  return out;
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
