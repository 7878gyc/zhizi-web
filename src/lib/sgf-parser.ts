import type { MoveNode, AnalysisInfo } from './go-types';
import { generateNodeId } from './go-types';
import { sgfToGtpCoord } from './sgf';

interface SgfProperties {
  [key: string]: string[];
}

interface SgfNode {
  properties: SgfProperties;
  children: SgfNode[];
}

interface SgfParseResult {
  root: SgfNode;
  boardSize: number;
  komi: number;
  rules: string;
  playerBlack: string;
  playerWhite: string;
}

const COL_LETTERS_GTP = 'ABCDEFGHJKLMNOPQRST';

const MAX_NODES = 50000;
let nodeCount = 0;

/** Parse SGF text into a tree of nodes */
export function parseSgf(text: string): SgfParseResult {
  // Strip BOM and normalize line endings
  let normalized = text.replace(/^\uFEFF/, '').replace(/\r?\n/g, '');

  // Find the first '(' — skip any preamble
  const firstParen = normalized.indexOf('(');
  if (firstParen === -1) throw new Error('Invalid SGF: no root node found');
  if (firstParen > 0) normalized = normalized.slice(firstParen);

  let pos = 0;

  function skipWhitespace() {
    while (pos < normalized.length && /\s/.test(normalized[pos])) pos++;
  }

  function parseProperty(): [string, string[]] | null {
    const keyMatch = normalized.slice(pos).match(/^[A-Z]{1,2}/);
    if (!keyMatch) return null;

    const key = keyMatch[0];
    pos += key.length;

    const values: string[] = [];
    while (pos < normalized.length && normalized[pos] === '[') {
      pos++;
      let value = '';
      while (pos < normalized.length && normalized[pos] !== ']') {
        if (normalized[pos] === '\\' && pos + 1 < normalized.length) {
          pos++;
          value += normalized[pos];
        } else {
          value += normalized[pos];
        }
        pos++;
      }
      if (pos < normalized.length) pos++;
      values.push(value);
    }

    return [key, values];
  }

  function parseNode(): SgfNode {
    const properties: SgfProperties = {};

    skipWhitespace();

    if (pos < normalized.length && normalized[pos] === ';') {
      pos++;
    }

    skipWhitespace();

    while (pos < normalized.length) {
      skipWhitespace();
      const ch = normalized[pos];
      if (ch === ';' || ch === '(' || ch === ')') break;

      const prop = parseProperty();
      if (!prop) break;
      properties[prop[0]] = prop[1];
    }

    const children: SgfNode[] = [];

    while (pos < normalized.length) {
      skipWhitespace();
      const ch = normalized[pos];

      if (ch === ')') break;

      if (ch === '(') {
        pos++;
        skipWhitespace();
        if (normalized[pos] === ';') {
          children.push(parseNode());
        }
        // Skip to matching ')' using depth counter
        let depth = 1;
        while (pos < normalized.length && depth > 0) {
          if (normalized[pos] === '(') depth++;
          else if (normalized[pos] === ')') depth--;
          if (depth > 0) pos++;
        }
        if (pos < normalized.length) pos++; // Skip the matching ')'
      } else if (ch === ';') {
        children.push(parseNode());
      } else {
        break;
      }
    }

    return { properties, children };
  }

  skipWhitespace();
  if (normalized[pos] === '(') pos++;

  const root = parseNode();

  let boardSize = 19;
  let komi = 7.5;
  let rules = 'chinese';
  let playerBlack = '';
  let playerWhite = '';

  if (root.properties.SZ) {
    boardSize = parseInt(root.properties.SZ[0], 10) || 19;
  }
  if (root.properties.KM) {
    komi = parseFloat(root.properties.KM[0]) || 6.5;
  }
  if (root.properties.RU) {
    const ru = root.properties.RU[0].toLowerCase();
    if (ru.includes('japan') || ru.includes('japanese')) {
      rules = 'japanese';
    } else if (ru.includes('aga')) {
      rules = 'aga';
    }
  }
  if (root.properties.PB) {
    playerBlack = root.properties.PB[0];
  }
  if (root.properties.PW) {
    playerWhite = root.properties.PW[0];
  }

  return { root, boardSize, komi, rules, playerBlack, playerWhite };
}

/** Convert SGF coordinate to (row, col) */
function sgfCoordToRowCol(coord: string, boardSize: number): { row: number; col: number } | null {
  if (coord.length < 2) return null;
  const col = coord.charCodeAt(0) - 97;
  const row = coord.charCodeAt(1) - 97;
  if (col < 0 || col >= boardSize || row < 0 || row >= boardSize) return null;
  return { row, col };
}

function rowColToGTP(row: number, col: number, boardSize: number): string {
  return COL_LETTERS_GTP[col] + (boardSize - row);
}

type AnalysisCache = Map<number, { data: AnalysisInfo[]; winrate: number | null }>;

/** Convert a coordinate token from an LZ property to GTP format.
 *  LZ coords may be SGF lowercase ("dd") or GTP uppercase ("D16"). */
function lzCoordToGtp(coord: string, boardSize: number): string {
  if (!coord || typeof coord !== 'string') return '';
  const first = coord.charCodeAt(0);
  if (first >= 65 && first <= 90) {
    // GTP-style uppercase, e.g. "D16"; validate against the board
    const col = COL_LETTERS_GTP.indexOf(coord[0]);
    const row = parseInt(coord.slice(1), 10);
    if (col >= 0 && row >= 1 && row <= boardSize) return coord;
    return '';
  }
  try {
    return sgfToGtpCoord(coord, boardSize);
  } catch {
    return '';
  }
}

/** Parse LZ property from SGF node */
function parseLZProperty(
  lz: string,
  boardSize: number
): { engineWinrate: number; candidates: AnalysisInfo[] } | null {
  try {
    // Recover newlines that were escaped in formatLZProperty to survive parseSgf's normalization
    let parts = lz.replace(/\\n/g, '\n').split('\n');

    // Fallback: newlines were stripped by normalize step (old format backward compat)
    // Header and moves become concatenated: "KataGo <wr> <visits> <scoreMean> <scoreStdev>move <coord> ..."
    if (parts.length < 2) {
      const firstMoveIdx = lz.indexOf('move ');
      if (firstMoveIdx > 0) {
        parts = [lz.substring(0, firstMoveIdx).trim(), lz.substring(firstMoveIdx)];
      }
    }

    if (parts.length < 2) {
      console.warn('[sgf-parser] LZ property format not recognized:', lz.substring(0, 200));
      return null;
    }

    // Line 1: KataGo <winrate> <visits> <scoreMean> <scoreStdev>
    const line1Parts = parts[0].trim().split(/\s+/);
    if (line1Parts.length < 3) return null;
    const engineWinrate = parseFloat(line1Parts[1]) / 100;

    // Line 2: move <coord> visits <n> winrate <n> prior <n> scoreMean <n> pv ...
    const line2 = parts.slice(1).join('\n');
    const candidateBlocks = line2.split(' info ');
    const candidates: AnalysisInfo[] = [];

    for (let i = 0; i < candidateBlocks.length; i++) {
      const tokens = candidateBlocks[i].trim().split(/\s+/);
      if (tokens.length < 8 || tokens[0] !== 'move') continue;

      const sgfCoord = tokens[1];
      const gtpMove = lzCoordToGtp(sgfCoord, boardSize);
      if (!gtpMove) continue;

      let visits = 0;
      let wr = 0;
      let prior = 0;
      let scoreMean = 0;
      const pv: string[] = [];

      let j = 2;
      while (j < tokens.length) {
        switch (tokens[j]) {
          case 'visits':
            visits = parseInt(tokens[j + 1]) || 0;
            j += 2;
            break;
          case 'winrate':
            wr = (parseInt(tokens[j + 1]) || 0) / 10000;
            j += 2;
            break;
          case 'prior':
            prior = (parseInt(tokens[j + 1]) || 0) / 10000;
            j += 2;
            break;
          case 'scoreMean':
            scoreMean = parseFloat(tokens[j + 1]) || 0;
            j += 2;
            break;
          case 'pv':
            j++;
            while (j < tokens.length && !['visits', 'winrate', 'prior', 'scoreMean', 'pv', 'info'].includes(tokens[j])) {
              const c = lzCoordToGtp(tokens[j], boardSize);
              if (c) pv.push(c);
              j++;
            }
            break;
          default:
            j++;
        }
      }

      candidates.push({
        move: gtpMove,
        winrate: wr,
        scoreMean,
        scoreStdev: 0,
        visits,
        prior,
        order: i,
        pv,
      });
    }

    return { engineWinrate, candidates };
  } catch {
    return null;
  }
}

/** Recursively convert SGF node tree to MoveNode tree */
function sgfNodeToMoveNode(
  sgfNode: SgfNode,
  parentId: string | null,
  moveNumber: number,
  boardSize: number,
  nextColor: 'black' | 'white',
  analysisCache: AnalysisCache,
): MoveNode | null {
  nodeCount++;
  if (nodeCount > MAX_NODES) throw new Error('SGF too large: exceeds 50000 nodes');

  const blackMove = sgfNode.properties.B?.[0];
  const whiteMove = sgfNode.properties.W?.[0];
  const moveCoord = blackMove || whiteMove;
  const color = blackMove ? 'black' : (whiteMove ? 'white' : null);
  const isBlack = color === 'black';

  if (!moveCoord && !color) {
    if (sgfNode.children.length === 0) return null;

    if (sgfNode.children.length === 1) {
      return sgfNodeToMoveNode(sgfNode.children[0], parentId, moveNumber, boardSize, nextColor, analysisCache);
    }

    const firstChild = sgfNodeToMoveNode(sgfNode.children[0], parentId, moveNumber, boardSize, nextColor, analysisCache);
    if (!firstChild) return null;

    for (let i = 1; i < sgfNode.children.length; i++) {
      const branch = sgfNodeToMoveNode(sgfNode.children[i], parentId, moveNumber, boardSize, nextColor, analysisCache);
      if (branch) {
        firstChild.children.push(branch);
      }
    }

    return firstChild;
  }

  if (!moveCoord || !color) return null;
  if (moveCoord === '' || moveCoord === 'tt') {
    // Pass move (or invalid coord): skip the node itself but keep its children,
    // replaying them at the same moveNumber so the game line is preserved.
    if (sgfNode.children.length === 0) return null;
    const firstChild = sgfNodeToMoveNode(
      sgfNode.children[0],
      parentId,
      moveNumber,
      boardSize,
      nextColor,
      analysisCache,
    );
    if (!firstChild) return null;
    for (let i = 1; i < sgfNode.children.length; i++) {
      const branch = sgfNodeToMoveNode(
        sgfNode.children[i],
        parentId,
        moveNumber,
        boardSize,
        nextColor,
        analysisCache,
      );
      if (branch) {
        firstChild.children.push(branch);
      }
    }
    return firstChild;
  }

  const pos = sgfCoordToRowCol(moveCoord, boardSize);
  if (!pos) return null;

  const gtpCoord = rowColToGTP(pos.row, pos.col, boardSize);

  const nodeId = generateNodeId();
  const moveNode: MoveNode = {
    id: nodeId,
    move: gtpCoord,
    color,
    children: [],
    parentId,
    moveNumber,
  };

  // Parse LZ property for analysis data
  const lzValue = sgfNode.properties.LZ?.[0];
  if (lzValue) {
    const parsed = parseLZProperty(lzValue, boardSize);
    if (parsed) {
      // engineWinrate is from engine's current-player perspective
      // For black node: engine analyzed from white's perspective → engineWinrate = white WR
      //   → black WR = 1 - engineWinrate
      // For white node: engine analyzed from black's perspective → engineWinrate = black WR
      const blackWinrate = isBlack ? (1 - parsed.engineWinrate) : parsed.engineWinrate;
      moveNode.winrate = blackWinrate;

      // Store in analysis cache (with engine-perspective winrate)
      analysisCache.set(moveNumber, {
        data: parsed.candidates,
        winrate: parsed.engineWinrate,
      });
    }
  }

  const nextMoveColor = color === 'black' ? 'white' : 'black';

  for (let i = 0; i < sgfNode.children.length; i++) {
    const child = sgfNodeToMoveNode(
      sgfNode.children[i],
      nodeId,
      moveNumber + 1,
      boardSize,
      nextMoveColor,
      analysisCache,
    );
    if (child) {
      moveNode.children.push(child);
    }
  }

  return moveNode;
}

/** Convert parsed SGF to MoveNode tree, extracting analysis data */
export function sgfToMoveTree(sgfText: string): {
  tree: MoveNode;
  boardSize: number;
  komi: number;
  rules: string;
  analysisCache: AnalysisCache;
  playerBlack: string;
  playerWhite: string;
} | null {
  try {
    nodeCount = 0;
    const { root, boardSize, komi, rules, playerBlack, playerWhite } = parseSgf(sgfText);

    const rootNode: MoveNode = {
      id: 'root',
      move: 'root',
      color: null,
      children: [],
      parentId: null,
      moveNumber: 0,
    };

    const analysisCache: AnalysisCache = new Map();
    const nextColor: 'black' | 'white' = 'black';

    if (root.properties.B || root.properties.W) {
      const moveNode = sgfNodeToMoveNode(root, 'root', 1, boardSize, nextColor, analysisCache);
      if (moveNode) {
        rootNode.children.push(moveNode);
      }
    } else {
      for (const child of root.children) {
        const moveNode = sgfNodeToMoveNode(child, 'root', 1, boardSize, nextColor, analysisCache);
        if (moveNode) {
          rootNode.children.push(moveNode);
        }
      }
    }

    return { tree: rootNode, boardSize, komi, rules, analysisCache, playerBlack, playerWhite };
  } catch {
    return null;
  }
}

export function parseSgfContent(sgfText: string): {
  tree: MoveNode;
  boardSize: number;
  komi: number;
  rules: string;
  analysisCache: AnalysisCache;
  playerBlack: string;
  playerWhite: string;
} | null {
  return sgfToMoveTree(sgfText);
}

export async function readSgfFile(file: File): Promise<{
  tree: MoveNode;
  boardSize: number;
  komi: number;
  rules: string;
  analysisCache: AnalysisCache;
  playerBlack: string;
  playerWhite: string;
} | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) {
        resolve(null);
        return;
      }
      const result = sgfToMoveTree(text);
      resolve(result);
    };
    reader.onerror = () => resolve(null);
    reader.readAsText(file, 'utf-8');
  });
}
