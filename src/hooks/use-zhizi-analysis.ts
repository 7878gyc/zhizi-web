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

  // Robust payload decoding (mirrors the sample's decodePayload)
  const decodePayload = useCallback((payload: unknown): string => {
    if (payload === null || payload === undefined) return '';
    if (typeof payload === 'string') return payload;
    if (payload instanceof ArrayBuffer) return new TextDecoder().decode(payload);
    if (ArrayBuffer.isView(payload)) return new TextDecoder().decode(payload);
    return String(payload);
  }, []);

  const processStdout = useCallback((text: string) => {
    if (!text) return;

    // Handle concatenated info blocks like the sample: split before each "info " token
    const candidates = parseInfoLine(text);

    if (candidates.length === 0) return;

    // Sort by order (missing order = 0, same as the sample)
    candidates.sort((a: AnalysisInfo, b: AnalysisInfo) => (a.order || 0) - (b.order || 0));

    // Replace old analysis data with the new batch
    setAnalysisData(candidates);

    // Update winrate from the best candidate (lowest order, typically order 0)
    const best = candidates[0];
    if (best && best.winrate !== undefined) {
      setCurrentWinrate(best.winrate);
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
        processStdout(decodePayload(payload));
      });

      socket.on('stderr', (payload: unknown) => {
        const text = decodePayload(payload);
        if (text) {
          setLogs(prev => [...prev.slice(-99), `[${new Date().toLocaleTimeString()}] ${text}`]);
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

  // Cleanup on unmount
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
  };
}
