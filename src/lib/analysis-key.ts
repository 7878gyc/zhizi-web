import type { SyncParams } from '@/hooks/use-zhizi-analysis';

export interface AnalysisSyncKeyInput {
  nodeId: string;
  boardSize: number;
  komi: number;
  rules: string;
  player: 'black' | 'white';
  moves: string[];
  handicapStones?: string[];
  handicapWhiteStones?: string[];
}

/**
 * 判断「是否需要为新局面重新同步引擎」的签名。
 *
 * 必须包含 nodeId：同一手数的不同分支盘面不同，只看手数会漏掉同步。
 */
export function buildAnalysisSyncKey(params: AnalysisSyncKeyInput): string {
  return JSON.stringify([
    params.nodeId,
    params.boardSize,
    params.komi,
    params.rules,
    params.player,
    params.moves,
    params.handicapStones ?? [],
    params.handicapWhiteStones ?? [],
  ]);
}

export function toSyncParams(input: AnalysisSyncKeyInput): SyncParams {
  return {
    boardSize: input.boardSize,
    komi: input.komi,
    rules: input.rules,
    player: input.player,
    moves: input.moves,
    handicapStones: input.handicapStones,
    handicapWhiteStones: input.handicapWhiteStones,
  };
}
