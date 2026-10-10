'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import type { AnalysisInfo, AiConfig } from '@/lib/go-types';
import { buildArgsString, parseInfoLine } from '@/lib/go-types';
import { mapZhiziError } from '@/lib/zhizi-errors';

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
  stopAnalysis: () => void;
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

const COMMAND_TIMEOUT_MS = 10000;
const MAX_RECONNECT_ATTEMPTS = 5;

interface PendingCommand {
  resolve: () => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export function useZhiziAnalysis(): UseZhiziAnalysisReturn {
  const socketRef = useRef<Socket | null>(null);
  const mountedRef = useRef(true);

  // 每次 connect / 重连都递增，用于让旧的 socket 回调与在途 GTP 全部失效
  const generationRef = useRef(0);
  // stdout 按行缓冲：一次事件不一定是完整一行
  const bufferRef = useRef('');
  const commandIdRef = useRef(0);
  const pendingRef = useRef<Map<number, PendingCommand>>(new Map());
  // 每次 sync 递增，用于丢弃被更新请求取代的在途同步
  const runIdRef = useRef(0);
  const aiReadyRef = useRef(false);
  // 最近一次同步参数，重连后据此整盘重放
  const lastParamsRef = useRef<SyncParams | null>(null);
  const configRef = useRef<AiConfig | null>(null);
  const closedByUserRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [analysisData, setAnalysisData] = useState<AnalysisInfo[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiReady, setAiReady] = useState(false);
  const [currentWinrate, setCurrentWinrate] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const log = useCallback((text: string) => {
    setLogs((prev) => [...prev.slice(-99), `[${new Date().toLocaleTimeString()}] ${text}`]);
  }, []);

  const decodePayload = useCallback((payload: unknown): string => {
    try {
      if (payload === null || payload === undefined) return '';
      if (typeof payload === 'string') return payload;
      if (payload instanceof ArrayBuffer) return new TextDecoder().decode(payload);
      if (ArrayBuffer.isView(payload)) return new TextDecoder().decode(payload);
      if (Array.isArray(payload)) {
        return new TextDecoder().decode(Uint8Array.from(payload as number[]));
      }
      if (typeof payload === 'object') {
        const obj = payload as { type?: string; data?: unknown };
        // Buffer-like { type: 'Buffer', data: number[] }
        if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
          return new TextDecoder().decode(Uint8Array.from(obj.data as number[]));
        }
        // 官方：一次事件可能是 { data: binary }
        if (obj.data !== undefined) return decodePayload(obj.data);
      }
      return String(payload);
    } catch {
      return '';
    }
  }, []);

  const dropPending = useCallback((reason: string) => {
    for (const [, p] of pendingRef.current) {
      clearTimeout(p.timer);
      p.reject(new Error(reason));
    }
    pendingRef.current.clear();
  }, []);

  /** 处理一条完整的 stdout 行：优先当作 GTP 响应，其次当作 info 分析行。 */
  const handleLine = useCallback((rawLine: string) => {
    const line = rawLine.replace(/\r$/, '');
    if (!line.trim()) return;

    // GTP 响应：`= 3 ...` 成功 / `? 3 ...` 失败（数字为命令 ID）
    const match = /^\s*([=?])(?:\s+(\d+))?(?:\s|$)/.exec(line);
    if (match) {
      const signal = match[1];
      const explicitId = match[2] ? Number(match[2]) : null;
      let pending: PendingCommand | undefined;
      let id = explicitId;
      if (id !== null && pendingRef.current.has(id)) {
        pending = pendingRef.current.get(id);
        pendingRef.current.delete(id);
      } else {
        // 引擎未回显 ID 时的兜底：串行发送时最多只有一个在途命令
        const first = pendingRef.current.entries().next();
        if (!first.done) {
          id = first.value[0];
          pending = first.value[1];
          pendingRef.current.delete(id);
        }
      }
      if (pending) {
        clearTimeout(pending.timer);
        if (signal === '=') pending.resolve();
        else pending.reject(new Error(line.replace(/^\s*[=?]\s*\d*\s*/, '').trim() || 'GTP error'));
      }
      return;
    }

    // 分析输出：解析 info 行
    const candidates = parseInfoLine(line);
    if (candidates.length === 0) return;
    candidates.sort((a, b) => (a.order || 0) - (b.order || 0));
    setAnalysisData(candidates);
    const best = candidates[0];
    if (best && best.winrate !== undefined) setCurrentWinrate(best.winrate);
  }, []);

  const consumeStdout = useCallback(
    (text: string, gen: number) => {
      if (gen !== generationRef.current) return;
      bufferRef.current += text;
      let idx: number;
      while ((idx = bufferRef.current.indexOf('\n')) !== -1) {
        const line = bufferRef.current.slice(0, idx);
        bufferRef.current = bufferRef.current.slice(idx + 1);
        handleLine(line);
      }
    },
    [handleLine],
  );

  /** 发送一条 GTP 命令并等待成功响应（带数字 ID，串行）。 */
  const sendCommand = useCallback(
    (cmd: string, gen: number): Promise<void> =>
      new Promise<void>((resolve, reject) => {
        const socket = socketRef.current;
        if (!socket || gen !== generationRef.current) {
          reject(new Error('连接不可用'));
          return;
        }
        const id = ++commandIdRef.current;
        const timer = setTimeout(() => {
          pendingRef.current.delete(id);
          reject(new Error(`GTP 命令超时: ${cmd}`));
        }, COMMAND_TIMEOUT_MS);
        pendingRef.current.set(id, { resolve, reject, timer });
        socket.emit('stdin', `${id} ${cmd}\n`);
      }),
    [],
  );

  /**
   * 顺序同步棋盘并启动分析，绝不流水线：
   * boardsize → kata-set-rules → komi → clear_board → 让子 → play → kata-analyze
   */
  const runSync = useCallback(
    async (params: SyncParams, gen: number) => {
      if (gen !== generationRef.current) return;
      const socket = socketRef.current;
      if (!socket?.connected || !aiReadyRef.current) return;

      dropPending('同步被新的请求取代');
      const runId = ++runIdRef.current;
      const superseded = () => gen !== generationRef.current || runId !== runIdRef.current;
      setAnalysisData([]);
      setCurrentWinrate(null);
      setIsAnalyzing(true);

      try {
        await sendCommand(`boardsize ${params.boardSize}`, gen);
        if (superseded()) return;
        if (params.rules) await sendCommand(`kata-set-rules ${params.rules}`, gen);
        if (superseded()) return;
        await sendCommand(`komi ${params.komi}`, gen);
        if (superseded()) return;
        await sendCommand('clear_board', gen);
        if (superseded()) return;
        if (params.handicapStones && params.handicapStones.length > 0) {
          await sendCommand(`set_free_handicap ${params.handicapStones.join(' ')}`, gen);
        }
        for (const move of params.moves) {
          if (superseded()) return;
          await sendCommand(`play ${move}`, gen);
        }

        if (superseded()) return;
        if (!socket.connected) return;

        // kata-analyze 会持续流式输出 info，不等它的 = 响应
        const player = params.player === 'black' ? 'B' : 'W';
        const interval = params.analyzeVisits || 50;
        const id = ++commandIdRef.current;
        socket.emit('stdin', `${id} kata-analyze ${player} ${interval}\n`);
      } catch (e) {
        if (superseded()) return;
        const message = e instanceof Error ? e.message : 'GTP 同步失败';
        log(message);
        setError(message);
        setIsAnalyzing(false);
      }
    },
    [dropPending, sendCommand, log],
  );

  const openSocket = useCallback(
    async (gen: number) => {
      const config = configRef.current;
      if (!config) return;

      try {
        // 每次连接 / 重连都取新的 Socket token，绝不复用旧 token
        const args = buildArgsString(config);
        const resp = await fetch('/api/auth/fetch-socketio-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ args }),
        });
        const data = await resp.json().catch(() => null);
        if (gen !== generationRef.current || closedByUserRef.current) return;
        if (!resp.ok || !data?.token || !data?.socketIOURL) {
          setError(mapZhiziError(data, '获取 WebSocket 令牌失败'));
          setIsConnecting(false);
          return;
        }

        if (socketRef.current) {
          socketRef.current.removeAllListeners();
          socketRef.current.disconnect();
          socketRef.current = null;
        }
        bufferRef.current = '';
        setAiReady(false);
        aiReadyRef.current = false;

        const socket = io(data.socketIOURL, {
          path: '/socket.io.v4',
          query: { 'zz-socketio-token': data.token },
          transports: ['websocket'],
          // 由我们接管重连：官方不保证旧 token 与棋盘状态仍在
          reconnection: false,
        });
        socketRef.current = socket;

        socket.on('connect', () => {
          if (gen !== generationRef.current) return;
          setIsConnected(true);
          setError(null);
        });

        socket.on('ready', () => {
          if (gen !== generationRef.current) return;
          reconnectAttemptsRef.current = 0;
          bufferRef.current = '';
          aiReadyRef.current = true;
          setAiReady(true);
          setIsConnecting(false);
          setError(null);
          // 重连后整盘重放，再 kata-analyze
          if (lastParamsRef.current) {
            void runSync(lastParamsRef.current, gen);
          }
        });

        socket.on('stdout', (payload: unknown) => {
          if (gen !== generationRef.current) return;
          consumeStdout(decodePayload(payload), gen);
        });

        socket.on('stderr', (payload: unknown) => {
          if (gen !== generationRef.current) return;
          const text = decodePayload(payload);
          if (text) log(text);
        });

        socket.on('disconnect', (reason) => {
          if (gen !== generationRef.current) return;
          aiReadyRef.current = false;
          setAiReady(false);
          setIsAnalyzing(false);
          setIsConnected(false);
          dropPending('连接断开');
          bufferRef.current = '';
          if (closedByUserRef.current || reason === 'io client disconnect') return;
          scheduleReconnect(gen);
        });

        socket.on('connect_error', (err: Error) => {
          if (gen !== generationRef.current) return;
          setError(`连接失败: ${err.message}`);
          setIsConnecting(false);
          setIsConnected(false);
          scheduleReconnect(gen);
        });
      } catch (err: unknown) {
        if (gen !== generationRef.current) return;
        setError(err instanceof Error ? err.message : '连接异常');
        setIsConnecting(false);
      }
    },
    // scheduleReconnect 通过 ref 间接引用，见下方定义顺序说明
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [consumeStdout, decodePayload, dropPending, log, runSync],
  );

  const scheduleReconnect = useCallback(
    (gen: number) => {
      if (closedByUserRef.current || gen !== generationRef.current) return;
      if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
        setError('重连失败，请手动重试');
        return;
      }
      reconnectAttemptsRef.current += 1;
      const delay = Math.min(1000 * 2 ** (reconnectAttemptsRef.current - 1), 10000);
      setError(`连接断开，${Math.round(delay / 1000)} 秒后重连...`);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = setTimeout(() => {
        if (closedByUserRef.current || gen !== generationRef.current) return;
        void openSocket(gen);
      }, delay);
    },
    [openSocket],
  );

  const connect = useCallback(
    async (config: AiConfig) => {
      closedByUserRef.current = false;
      reconnectAttemptsRef.current = 0;
      configRef.current = config;
      const gen = ++generationRef.current;
      runIdRef.current += 1;

      // 丢弃旧连接与旧 GTP 状态
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      dropPending('重新连接');
      bufferRef.current = '';
      aiReadyRef.current = false;
      lastParamsRef.current = null;

      setAnalysisData([]);
      setCurrentWinrate(null);
      setLogs([]);
      setError(null);
      setIsConnecting(true);
      setAiReady(false);
      setIsAnalyzing(false);
      setIsConnected(false);

      await openSocket(gen);
    },
    [dropPending, openSocket],
  );

  const disconnect = useCallback(() => {
    closedByUserRef.current = true;
    generationRef.current += 1;
    runIdRef.current += 1;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    const socket = socketRef.current;
    if (socket) {
      // 断开前先 stop
      if (socket.connected) socket.emit('stdin', 'stop\n');
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    }
    dropPending('已断开');
    bufferRef.current = '';
    aiReadyRef.current = false;
    lastParamsRef.current = null;
    setAiReady(false);
    setIsAnalyzing(false);
    setIsConnected(false);
    setIsConnecting(false);
    setAnalysisData([]);
    setCurrentWinrate(null);
    setLogs([]);
  }, [dropPending]);

  const sendGtpCommand = useCallback(
    (cmd: string) => {
      const socket = socketRef.current;
      if (socket?.connected) socket.emit('stdin', cmd.endsWith('\n') ? cmd : `${cmd}\n`);
    },
    [],
  );

  const syncAndAnalyze = useCallback(
    (params: SyncParams) => {
      lastParamsRef.current = params;
      if (!aiReadyRef.current) return; // 未就绪：ready 后会自动重放
      void runSync(params, generationRef.current);
    },
    [runSync],
  );

  const stopAnalysis = useCallback(() => {
    const socket = socketRef.current;
    if (socket?.connected) socket.emit('stdin', 'stop\n');
    setIsAnalyzing(false);
  }, []);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      closedByUserRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
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
    stopAnalysis,
  };
}
