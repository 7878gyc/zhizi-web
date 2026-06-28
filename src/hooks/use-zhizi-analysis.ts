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

  const processStdout = useCallback((text: string) => {
    const lines = text.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('info ')) continue;

      const info = parseAnalysisLine(trimmed);
      if (!info) continue;

      // Single info line may contain multiple move suggestions
      // Each "info" line represents one suggestion
      setAnalysisData((prev) => {
        // Replace existing data with new batch from this analysis run
        // Keep moves from the same analysis, sort by order
        const merged = new Map<string, AnalysisInfo>();
        // Only keep moves from the same "run" — if this info has order=0, start fresh
        const existing = (info.order === 0) ? [] : prev;
        for (const item of existing) {
          merged.set(item.move, item);
        }
        merged.set(info.move, info);
        return Array.from(merged.values()).sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
      });

      // Update winrate from the best move (order 0)
      if (info.order === 0 && info.winrate !== undefined) {
        setCurrentWinrate(info.winrate);
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
        setError(data.error || data.key || data.message || '获取 WebSocket 令牌失败');
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
        processStdout(text);
      });

      socket.on('stderr', (payload: ArrayBuffer | string) => {
        const text = typeof payload === 'string'
          ? payload
          : new TextDecoder().decode(payload);
        setLogs(prev => [...prev.slice(-99), `[${new Date().toLocaleTimeString()}] ${text}`]);
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

    // Start analysis — use lz-analyze format with interval
    // lz-analyze <color> <visits> — sends periodic updates
    const visits = params.analyzeVisits || 200;
    commands.push(`lz-analyze ${params.player} ${visits}`);

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
