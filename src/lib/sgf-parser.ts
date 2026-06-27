import type { MoveNode } from './go-types';
import { generateNodeId } from './go-types';

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
}

/** Parse SGF text into a tree of nodes */
export function parseSgf(text: string): SgfParseResult {
  // Normalize: remove line breaks
  const normalized = text.replace(/\r?\n/g, '');

  let pos = 0;

  function skipWhitespace() {
    while (pos < normalized.length && /\s/.test(normalized[pos])) pos++;
  }

  function parseProperty(): [string, string[]] | null {
    // Property key: one or two uppercase letters
    const keyMatch = normalized.slice(pos).match(/^[A-Z]{1,2}/);
    if (!keyMatch) return null;

    const key = keyMatch[0];
    pos += key.length;

    const values: string[] = [];
    while (pos < normalized.length && normalized[pos] === '[') {
      pos++; // skip '['
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
      if (pos < normalized.length) pos++; // skip ']'
      values.push(value);
    }

    return [key, values];
  }

  function parseNode(): SgfNode {
    const properties: SgfProperties = {};

    skipWhitespace();

    // Expect ';'
    if (pos < normalized.length && normalized[pos] === ';') {
      pos++;
    }

    skipWhitespace();

    // Parse properties until we hit ';', '(', ')' or end
    while (pos < normalized.length) {
      skipWhitespace();
      const ch = normalized[pos];
      if (ch === ';' || ch === '(' || ch === ')') break;

      const prop = parseProperty();
      if (!prop) break;
      properties[prop[0]] = prop[1];
    }

    // Parse children (branches and sequences)
    const children: SgfNode[] = [];

    while (pos < normalized.length) {
      skipWhitespace();
      const ch = normalized[pos];

      if (ch === ')') break;

      if (ch === '(') {
        pos++; // skip '('
        // Parse a branch - it may start with nodes
        skipWhitespace();
        if (normalized[pos] === ';') {
          children.push(parseNode());
        }
        // Continue parsing within this branch
        while (pos < normalized.length) {
          skipWhitespace();
          if (normalized[pos] === ')') {
            pos++;
            break;
          }
          if (normalized[pos] === ';') {
            children.push(parseNode());
          } else if (normalized[pos] === '(') {
            pos++;
            if (normalized[pos] === ';') {
              children.push(parseNode());
            }
          } else {
            break;
          }
        }
      } else if (ch === ';') {
        children.push(parseNode());
      } else {
        break;
      }
    }

    return { properties, children };
  }

  // Start parsing - find opening '('
  skipWhitespace();
  if (normalized[pos] === '(') pos++;

  const root = parseNode();

  // Extract metadata
  let boardSize = 19;
  let komi = 6.5;
  let rules = 'chinese';

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
    } else {
      rules = 'chinese';
    }
  }

  return { root, boardSize, komi, rules };
}

/** Convert SGF coordinate to (row, col) - SGF uses 'a'=0, 's'=18, skip 'i' */
function sgfCoordToRowCol(coord: string, boardSize: number): { row: number; col: number } | null {
  if (coord.length < 2) return null;

  const col = coord.charCodeAt(0) - 97; // 'a' = 0
  const row = coord.charCodeAt(1) - 97; // 'a' = 0

  // In SGF, 'i' is NOT skipped. SGF uses a-s for 19x19 (all 19 letters).
  // So column 'a'=0, 'b'=1, ..., 's'=18
  // Row 'a'=0 (top) to 's'=18 (bottom)

  if (col < 0 || col >= boardSize || row < 0 || row >= boardSize) return null;

  return { row, col };
}

/** Convert (row, col) to GTP coordinate */
function rowColToGTP(row: number, col: number, boardSize: number): string {
  const COL_LETTERS = 'ABCDEFGHJKLMNOPQRST'; // Skip 'I'
  const letter = COL_LETTERS[col];
  const number = boardSize - row;
  return `${letter}${number}`;
}

/** Recursively convert SGF node tree to MoveNode tree */
function sgfNodeToMoveNode(
  sgfNode: SgfNode,
  parentId: string | null,
  moveNumber: number,
  boardSize: number,
  nextColor: 'black' | 'white'
): MoveNode | null {
  // Check for a move in this node
  const blackMove = sgfNode.properties.B?.[0];
  const whiteMove = sgfNode.properties.W?.[0];
  const moveCoord = blackMove || whiteMove;
  const color = blackMove ? 'black' : (whiteMove ? 'white' : null);

  // If no move in this node, but it's the root with properties, we skip it
  // and process its children directly
  if (!moveCoord && !color) {
    // This is a game-info node (root), process children
    if (sgfNode.children.length === 0) return null;

    if (sgfNode.children.length === 1) {
      return sgfNodeToMoveNode(sgfNode.children[0], parentId, moveNumber, boardSize, nextColor);
    }

    // Multiple children from root - create a branch point
    // This shouldn't normally happen from root, but handle it
    const firstChild = sgfNodeToMoveNode(sgfNode.children[0], parentId, moveNumber, boardSize, nextColor);
    if (!firstChild) return null;

    // Add other children as branches
    for (let i = 1; i < sgfNode.children.length; i++) {
      const branch = sgfNodeToMoveNode(sgfNode.children[i], parentId, moveNumber, boardSize, nextColor);
      if (branch) {
        firstChild.children.push(branch);
      }
    }

    return firstChild;
  }

  if (!moveCoord || !color) return null;

  // Handle pass
  if (moveCoord === '' || moveCoord === 'tt') {
    // Pass move - skip for now, could handle later
    return null;
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

  const nextMoveColor = color === 'black' ? 'white' : 'black';

  // Process children
  for (let i = 0; i < sgfNode.children.length; i++) {
    const child = sgfNodeToMoveNode(
      sgfNode.children[i],
      nodeId,
      moveNumber + 1,
      boardSize,
      nextMoveColor
    );
    if (child) {
      moveNode.children.push(child);
    }
  }

  return moveNode;
}

/** Convert parsed SGF to MoveNode tree */
export function sgfToMoveTree(sgfText: string): {
  tree: MoveNode;
  boardSize: number;
  komi: number;
  rules: string;
} | null {
  try {
    const { root, boardSize, komi, rules } = parseSgf(sgfText);

    const rootNode: MoveNode = {
      id: 'root',
      move: 'root',
      color: null,
      children: [],
      parentId: null,
      moveNumber: 0,
    };

    // Convert SGF nodes to MoveNode children of root
    const nextColor: 'black' | 'white' = 'black';
    // Check if first move property is in root node
    if (root.properties.B || root.properties.W) {
      const moveNode = sgfNodeToMoveNode(root, 'root', 1, boardSize, nextColor);
      if (moveNode) {
        rootNode.children.push(moveNode);
      }
    } else {
      // Root is game-info only, process children
      for (const child of root.children) {
        const moveNode = sgfNodeToMoveNode(child, 'root', 1, boardSize, nextColor);
        if (moveNode) {
          rootNode.children.push(moveNode);
        }
      }
    }

    return { tree: rootNode, boardSize, komi, rules };
  } catch {
    return null;
  }
}

/** Parse SGF content string directly into a MoveNode tree */
export function parseSgfContent(sgfText: string): {
  tree: MoveNode;
  boardSize: number;
  komi: number;
  rules: string;
} | null {
  return sgfToMoveTree(sgfText);
}

/** Read an SGF file and parse it */
export async function readSgfFile(file: File): Promise<{
  tree: MoveNode;
  boardSize: number;
  komi: number;
  rules: string;
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
