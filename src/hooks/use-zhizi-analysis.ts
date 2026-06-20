'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import type { AnalysisInfo, AiConfig } from '@/lib/go-types';
import { buildArgsString, parseAnalysisLine } from '@/lib/go-types';
import { getToken } from '@/lib/auth';

interface UseZhiziAnalysisReturn {
  analysisData: AnalysisInfo[];
  isConnecting: boolean;
  isAnalyzing: boolean;
  aiReady: boolean;
  isConnected: boolean;
  currentWinrate: number | null;
  error: string | null;
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
  moves: string[];   // GTP moves like ["B Q16", "W D4", ...]
  handicapStones?: string[]; // e.g. ["D4", "Q16"]
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

  const stdoutBuffer = useRef('');

  const processStdout = useCallback((text: string) => {
    const lines = text.split('\n');
    const newAnalysis: AnalysisInfo[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('info ')) {
        const info = parseAnalysisLine(trimmed);
        if (info) {
          newAnalysis.push(info);
        }
      }
    }

    if (newAnalysis.length > 0) {
      setAnalysisData((prev) => {
        // Merge with existing: update same moves, add new ones
        const merged = new Map<string, AnalysisInfo>();
        for (const item of prev) {
          merged.set(item.move, item);
        }
        for (const item of newAnalysis) {
          merged.set(item.move, item);
        }
        return Array.from(merged.values()).sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
      });

      // Update winrate from the best move (order 0 or first)
      const bestMove = newAnalysis.reduce((best, curr) =>
        (curr.order ?? 999) < (best.order ?? 999) ? curr : best
      , newAnalysis[0]);
      if (bestMove?.winrate !== undefined) {
        setCurrentWinrate(bestMove.winrate);
      }
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
        setError(data.error || data.key || '获取 WebSocket 令牌失败');
        setIsConnecting(false);
        return;
      }

      // Step 2: Connect via Socket.IO
      const socket = io(data.socketIOURL, {
        path: '/socket.io.v4',
        query: { 'zz-socketio-token': data.token },
        transports: ['websocket'],
        reconnection: false,
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

      socket.on('stdout', (payload: ArrayBuffer | string) => {
        const text = typeof payload === 'string'
          ? payload
          : new TextDecoder().decode(payload);
        stdoutBuffer.current += text;
        processStdout(text);
      });

      socket.on('stderr', (payload: ArrayBuffer | string) => {
        const text = typeof payload === 'string'
          ? payload
          : new TextDecoder().decode(payload);
        // We can log stderr for debugging
        console.debug('[GTP stderr]', text);
      });

      socket.on('disconnect', () => {
        setAiReady(false);
        setIsAnalyzing(false);
        setIsConnecting(false);
        setIsConnected(false);
      });

      socket.on('connect_error', (err: Error) => {
        setError(`连接失败: ${err.message}`);
        setIsConnecting(false);
      });

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '连接异常');
      setIsConnecting(false);
    }
  }, [processStdout]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setAiReady(false);
    setIsAnalyzing(false);
    setIsConnected(false);
    setAnalysisData([]);
    setCurrentWinrate(null);
  }, []);

  const sendGtpCommand = useCallback((cmd: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('stdin', cmd + '\n');
    }
  }, []);

  const syncAndAnalyze = useCallback((params: SyncParams) => {
    if (!socketRef.current?.connected) return;

    setAnalysisData([]);
    setIsAnalyzing(true);
    setCurrentWinrate(null);

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

    // Start analysis
    const visits = params.analyzeVisits || 50;
    commands.push(`kata-analyze ${params.player} ${visits}`);

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
    connect,
    disconnect,
    sendGtpCommand,
    syncAndAnalyze,
  };
}
