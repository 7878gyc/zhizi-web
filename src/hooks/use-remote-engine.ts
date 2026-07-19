'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

export interface SshTaskParams {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  command: string;
}

export interface LogEntry {
  type: 'stdout' | 'stderr' | 'info' | 'error';
  data: string;
  timestamp: number;
}

interface UseRemoteEngineReturn {
  connect: () => void;
  disconnect: () => void;
  startTask: (params: SshTaskParams) => void;
  isConnected: boolean;
  logs: LogEntry[];
  isRunning: boolean;
  error: string | null;
}

const MAX_LOG_ENTRIES = 500;

export function useRemoteEngine(): UseRemoteEngineReturn {
  const socketRef = useRef<Socket | null>(null);
  const mountedRef = useRef(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    const socket = io(window.location.origin, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      if (!mountedRef.current) return;
      setIsConnected(true);
      setError(null);
    });

    socket.on('task-started', () => {
      if (!mountedRef.current) return;
      setIsRunning(true);
      setError(null);
      setLogs([
        {
          type: 'info',
          data: '--- SSH 任务已启动 ---\n',
          timestamp: Date.now(),
        },
      ]);
    });

    socket.on(
      'task-output',
      (payload: { type: 'stdout' | 'stderr'; data: string }) => {
        if (!mountedRef.current) return;
        setLogs((prev) =>
          prev
            .slice(-(MAX_LOG_ENTRIES - 1))
            .concat({
              type: payload.type,
              data: payload.data,
              timestamp: Date.now(),
            }),
        );
      },
    );

    socket.on(
      'task-end',
      (payload: { exitCode?: number; signal?: string; reason?: string }) => {
        if (!mountedRef.current) return;
        setIsRunning(false);

        let message: string;
        if (payload.reason === 'idle-timeout') {
          message = '\n--- 连接因超时自动断开 ---\n';
        } else if (payload.reason === 'user-stopped') {
          message = '\n--- 任务已手动停止 ---\n';
        } else {
          message = `\n--- 进程结束，退出码: ${payload.exitCode ?? 'N/A'} ---\n`;
        }

        setLogs((prev) =>
          prev
            .slice(-(MAX_LOG_ENTRIES - 1))
            .concat({ type: 'info', data: message, timestamp: Date.now() }),
        );
      },
    );

    socket.on('task-error', (payload: { error: string }) => {
      if (!mountedRef.current) return;
      setError(payload.error);
      setIsRunning(false);
      setLogs((prev) =>
        prev
          .slice(-(MAX_LOG_ENTRIES - 1))
          .concat({
            type: 'error',
            data: `[错误] ${payload.error}\n`,
            timestamp: Date.now(),
          }),
      );
    });

    socket.on('disconnect', (reason: string) => {
      if (!mountedRef.current) return;
      setIsConnected(false);
      setIsRunning(false);
      if (reason !== 'io client disconnect') {
        setError('连接断开，正在重连...');
      }
    });

    socket.on('connect_error', (err: Error) => {
      if (!mountedRef.current) return;
      setError(`连接失败: ${err.message}`);
    });
  }, []);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setIsConnected(false);
    setIsRunning(false);
    setLogs([]);
    setError(null);
  }, []);

  const startTask = useCallback((params: SshTaskParams) => {
    if (!socketRef.current?.connected) {
      setError('未连接到服务器');
      return;
    }
    setError(null);
    setLogs([]);
    socketRef.current.emit('start-ssh-task', params);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  return {
    connect,
    disconnect,
    startTask,
    isConnected,
    logs,
    isRunning,
    error,
  };
}
