'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import type { AnalysisInfo, AiConfig } from '@/lib/go-types';
import { buildArgsString, parseInfoLine } from '@/lib/go-types';
import { getToken } from '@/lib/auth';

interface UseZhiziAnalysisReturn {
  analysisData: AnalysisInfo[];
  isConnecting: boolean;
  isAnalyzing: boolean;
  aiReady: boolean;
  isConnected: boolean;
  currentWinrate: number | null;
  error: string | null;
  logs: string[];
  connect: (config: AiConfig) => Promise<void>;
  disconnect: () => void;
  sendGtpCommand: (cmd: string) => void;
  syncAndAnalyze: (params: SyncParams) => void;
  isBatchAnalyzing: boolean;
  batchProgress: { current: number; total: number };
  batchResults: HawkEyeMoveResult[];
  startBatchAnalysis: (params: SyncParams) => Promise<void>;
  stopBatchAnalysis: () => void;
}

export interface HawkEyeMoveResult {
  moveNumber: number;
  moveColor: string | null;
  actualMove: string | null;
  winrate: number | null;       // Black-perspective winrate at this position
  aiBestMove: string | null;
  aiMatches: string[];
  isMatch: boolean;
  isBest: boolean;
  matchRank: number | null;
  scoreMean: number | null;
  winrateDrop: number | null;   // Black-perspective winrate drop after this move
  isProblem: boolean;
  problemSeverity: number;      // 0=ok, 1=-3%, 2=-6%, 3=-12%, 4=-24%
}

export interface HawkEyeStats {
  totalMoves: number;
  analyzedMoves: number;
  matchCount: number;
  bestCount: number;
  matchRate: number;
  bestRate: number;
  avgWinrateDrop: number;
  problemMoveNumbers: number[];
}

export interface SyncParams {
  boardSize: number;
  komi: number;
  rules: string;
  player: 'black' | 'white';
  moves: string[];
  handicapStones?: string[];
  analyzeVisits?: number;
}

export function useZhiziAnalysis(): UseZhiziAnalysisReturn {
  const socketRef = useRef<Socket | null>(null);
  const [analysisData, setAnalysisData] = useState<AnalysisInfo[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiReady, setAiReady] = useState(false);
  const [currentWinrate, setCurrentWinrate] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  // Batch (hawk-eye) analysis state
  const [isBatchAnalyzing, setIsBatchAnalyzing] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [batchResults, setBatchResults] = useState<HawkEyeMoveResult[]>([]);
  const batchResolveRef = useRef<((analysis: AnalysisInfo[]) => void) | null>(null);
  const batchCancelledRef = useRef(false);
  const isBatchAnalyzingRef = useRef(false);

  // Problem thresholds (same as LizzieYZY defaults)
  const PROBLEM_THRESHOLDS = [0, -3, -6, -12, -24];

  // Robust payload decoding (mirrors the sample's decodePayload)
  const decodePayload = useCallback((payload: unknown): string => {
    try {
      if (payload === null || payload === undefined) return '';
      if (typeof payload === 'string') return payload;
      if (payload instanceof ArrayBuffer) return new TextDecoder().decode(payload);
      if (ArrayBuffer.isView(payload)) return new TextDecoder().decode(payload);
      return String(payload);
    } catch {
      return '';
    }
  }, []);

  const processStdout = useCallback((text: string) => {
    try {
      if (!text) return;

      const candidates = parseInfoLine(text);
      if (candidates.length === 0) return;

      // During batch analysis, intercept stdout for the promise instead of normal processing
      if (isBatchAnalyzingRef.current) {
        if (batchResolveRef.current) {
          const resolve = batchResolveRef.current;
          batchResolveRef.current = null;
          resolve(candidates);
        }
        return;
      }

      candidates.sort((a: AnalysisInfo, b: AnalysisInfo) => (a.order || 0) - (b.order || 0));

      setAnalysisData(candidates);

      const best = candidates[0];
      if (best && best.winrate !== undefined) {
        setCurrentWinrate(best.winrate);
      }
    } catch (e) {
      console.error('processStdout error:', e);
    }
  }, []);

  const connect = useCallback(async (config: AiConfig) => {
    const token = getToken();
    if (!token) {
      setError('未登录，请先登录');
      return;
    }

    setIsConnecting(true);
    setError(null);
    setAiReady(false);
    setAnalysisData([]);
    setCurrentWinrate(null);

    try {
      // Step 1: Fetch Socket.IO token
      const args = buildArgsString(config);
      const resp = await fetch('/api/auth/fetch-socketio-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ args }),
      });

      const data = await resp.json();
      if (!resp.ok || !data.token || !data.socketIOURL) {
        setError(data.error || data.key || data.message || '获取 WebSocket 令牌失败');
        setIsConnecting(false);
        return;
      }

      // Step 2: Connect via Socket.IO
      const socket = io(data.socketIOURL, {
        path: '/socket.io.v4',
        query: { 'zz-socketio-token': data.token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        setIsConnected(true);
      });

      socket.on('ready', () => {
        setAiReady(true);
        setIsConnecting(false);
        setIsAnalyzing(false);
      });

      socket.on('stdout', (payload: unknown) => {
        try {
          processStdout(decodePayload(payload));
        } catch (e) {
          console.error('stdout handler error:', e);
        }
      });

      socket.on('stderr', (payload: unknown) => {
        try {
          const text = decodePayload(payload);
          if (text) {
            setLogs(prev => [...prev.slice(-99), `[${new Date().toLocaleTimeString()}] ${text}`]);
          }
        } catch (e) {
          console.error('stderr handler error:', e);
        }
      });

      socket.on('disconnect', (reason) => {
        setAiReady(false);
        setIsAnalyzing(false);
        setIsConnecting(false);
        setIsConnected(false);
        if (reason !== 'io client disconnect') {
          setError('连接断开，正在重连...');
        }
      });

      socket.on('connect_error', (err: Error) => {
        setError(`连接失败: ${err.message}`);
        setIsConnecting(false);
      });

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '连接异常');
      setIsConnecting(false);
    }
  }, [processStdout, decodePayload]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setAiReady(false);
    setIsAnalyzing(false);
    setIsConnected(false);
    setIsConnecting(false);
    setAnalysisData([]);
    setCurrentWinrate(null);
    setLogs([]);
  }, []);

  const sendGtpCommand = useCallback((cmd: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('stdin', cmd + '\n');
    }
  }, []);

  const syncAndAnalyze = useCallback((params: SyncParams) => {
    if (!socketRef.current?.connected) return;

    setIsAnalyzing(true);
    setAnalysisData([]);

    const commands: string[] = [];

    // Sync engine state
    commands.push(`boardsize ${params.boardSize}`);
    commands.push(`komi ${params.komi}`);
    if (params.rules) {
      commands.push(`kata-set-rules ${params.rules}`);
    }
    commands.push('clear_board');

    // Set handicap stones
    if (params.handicapStones && params.handicapStones.length > 0) {
      commands.push(`set_free_handicap ${params.handicapStones.join(' ')}`);
    }

    // Replay moves
    for (const move of params.moves) {
      commands.push(`play ${move}`);
    }

    // Start analysis — use kata-analyze (interval in centiseconds, same as the sample)
    const interval = params.analyzeVisits || 50;
    const player = params.player === 'black' ? 'B' : 'W';
    commands.push(`kata-analyze ${player} ${interval}`);

    // Send all commands
    for (const cmd of commands) {
      socketRef.current.emit('stdin', cmd + '\n');
    }
  }, []);

  const waitForAnalysis = useCallback((): Promise<AnalysisInfo[]> => {
    return new Promise<AnalysisInfo[]>((resolve) => {
      batchResolveRef.current = resolve;
      // Safety timeout: resolve empty after 60s
      setTimeout(() => {
        if (batchResolveRef.current === resolve) {
          batchResolveRef.current = null;
          resolve([]);
        }
      }, 60000);
    });
  }, []);

  const stopBatchAnalysis = useCallback(() => {
    batchCancelledRef.current = true;
    setIsBatchAnalyzing(false);
    isBatchAnalyzingRef.current = false;
  }, []);

  const startBatchAnalysis = useCallback(async (params: SyncParams) => {
    const socket = socketRef.current;
    if (!socket?.connected) return;

    const moves = params.moves; // ["B Q16", "W D4", ...]
    const totalPositions = moves.length + 1;
    const results: HawkEyeMoveResult[] = [];

    setIsBatchAnalyzing(true);
    isBatchAnalyzingRef.current = true;
    batchCancelledRef.current = false;
    setBatchProgress({ current: 0, total: totalPositions });
    setBatchResults([]);

    try {
      for (let k = 0; k <= moves.length; k++) {
        if (batchCancelledRef.current) break;

        // Build commands for position K (after K moves have been played)
        const commands: string[] = [];
        commands.push(`boardsize ${params.boardSize}`);
        commands.push(`komi ${params.komi}`);
        if (params.rules) commands.push(`kata-set-rules ${params.rules}`);
        commands.push('clear_board');

        for (let i = 0; i < k; i++) {
          commands.push(`play ${moves[i]}`);
        }

        const player = k % 2 === 0 ? 'B' : 'W';
        commands.push(`kata-analyze ${player} 50`);

        // Clear any stale resolve before sending new commands
        batchResolveRef.current = null;

        for (const cmd of commands) {
          socket.emit('stdin', cmd + '\n');
        }

        // Wait for one analysis response
        const candidates = await waitForAnalysis();
        if (batchCancelledRef.current) break;

        if (candidates.length === 0) {
          // No analysis data, record empty result and continue
          results.push({
            moveNumber: k,
            moveColor: k > 0 ? (k % 2 === 1 ? 'black' : 'white') : null,
            actualMove: k < moves.length ? moves[k].split(' ')[1] : null,
            winrate: null,
            aiBestMove: null,
            aiMatches: [],
            isMatch: false,
            isBest: false,
            matchRank: null,
            scoreMean: null,
            winrateDrop: null,
            isProblem: false,
            problemSeverity: 0,
          });
        } else {
          candidates.sort((a, b) => (a.order || 0) - (b.order || 0));

          // Convert winrate to Black's perspective
          const rawWinrate = candidates[0]?.winrate;
          const blackWinrate = rawWinrate != null
            ? (k % 2 === 0 ? rawWinrate : 1 - rawWinrate)
            : null;

          // Check if the actual player move matches AI candidates
          let isMatch = false;
          let isBest = false;
          let matchRank: number | null = null;
          if (k < moves.length) {
            const actualCoord = moves[k].split(' ')[1];
            const matchIdx = candidates.findIndex(c => c.move === actualCoord);
            if (matchIdx >= 0 && matchIdx < 5) {
              isMatch = true;
              isBest = matchIdx === 0;
              matchRank = matchIdx + 1;
            }
          }

          results.push({
            moveNumber: k,
            moveColor: k > 0 ? (k % 2 === 1 ? 'black' : 'white') : null,
            actualMove: k < moves.length ? moves[k].split(' ')[1] : null,
            winrate: blackWinrate,
            aiBestMove: candidates[0]?.move ?? null,
            aiMatches: candidates.slice(0, 5).map(c => c.move),
            isMatch,
            isBest,
            matchRank,
            scoreMean: candidates[0]?.scoreMean ?? candidates[0]?.scoreLead ?? null,
            winrateDrop: null,
            isProblem: false,
            problemSeverity: 0,
          });
        }

        setBatchResults([...results]);
        setBatchProgress({ current: k + 1, total: totalPositions });

        // Small delay between positions to let engine stabilize
        await new Promise(r => setTimeout(r, 300));
      }

      // Post-process: compute winrate drops and problem moves
      for (let i = 1; i < results.length; i++) {
        const prev = results[i - 1];
        const curr = results[i];
        if (prev.winrate != null && curr.winrate != null) {
          const drop = curr.winrate - prev.winrate;
          curr.winrateDrop = curr.moveColor === 'black'
            ? drop   // Black's move: positive drop means Black gained
            : -drop; // White's move: flip sign so drop is from Black's perspective
        }
      }

      // Tag problem moves based on winrate drop
      for (let i = 1; i < results.length; i++) {
        const drop = results[i].winrateDrop;
        if (drop != null) {
          for (let s = PROBLEM_THRESHOLDS.length - 1; s >= 0; s--) {
            if (drop <= PROBLEM_THRESHOLDS[s]) {
              results[i].isProblem = s > 0;
              results[i].problemSeverity = s;
              break;
            }
          }
        }
      }

      setBatchResults([...results]);
    } catch (err) {
      console.error('Batch analysis error:', err);
    } finally {
      setIsBatchAnalyzing(false);
      isBatchAnalyzingRef.current = false;
    }
  }, [waitForAnalysis]);
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  return {
    analysisData,
    isConnecting,
    isAnalyzing,
    aiReady,
    isConnected,
    currentWinrate,
    error,
    logs,
    connect,
    disconnect,
    sendGtpCommand,
    syncAndAnalyze,
    isBatchAnalyzing,
    batchProgress,
    batchResults,
    startBatchAnalysis,
    stopBatchAnalysis,
  };
}
