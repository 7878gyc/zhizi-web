'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useRemoteEngine, type SshTaskParams, type LogEntry } from '@/hooks/use-remote-engine';

const SSH_PREFIX = 'zhizi_ssh_';

interface RemoteEnginePanelProps {
  isActive: boolean;
}

export default function RemoteEnginePanel({ isActive }: RemoteEnginePanelProps) {
  const { connect, disconnect, startTask, isConnected, logs, isRunning, error } =
    useRemoteEngine();

  const [host, setHost] = useState('');
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [command, setCommand] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const autoStartedRef = useRef(false);

  const logEndRef = useRef<HTMLDivElement>(null);

  // On mount: read SSH config from sessionStorage (set by login page)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storage = window.sessionStorage;
    const savedHost = storage.getItem(`${SSH_PREFIX}host`);
    if (!savedHost) return;

    setHost(savedHost);
    setPort(parseInt(storage.getItem(`${SSH_PREFIX}port`) || '22', 10));
    setUsername(storage.getItem(`${SSH_PREFIX}username`) || '');
    setCommand(storage.getItem(`${SSH_PREFIX}command`) || '');
    const savedPwd = storage.getItem(`${SSH_PREFIX}password`);
    if (savedPwd) setPassword(savedPwd);
    const savedKey = storage.getItem(`${SSH_PREFIX}private_key`);
    if (savedKey) setPrivateKey(savedKey);
  }, []);

  // Auto-connect/disconnect when panel becomes active/inactive
  useEffect(() => {
    if (isActive) {
      connect();
    } else {
      disconnect();
      autoStartedRef.current = false;
    }
    return () => {
      disconnect();
      autoStartedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  // Auto-submit task when connected and config was loaded from sessionStorage
  useEffect(() => {
    if (!isConnected || autoStartedRef.current) return;
    if (!host.trim() || !username.trim() || !command.trim()) return;

    autoStartedRef.current = true;

    // Delay slightly so the socket is fully ready
    const timer = setTimeout(() => {
      const params: SshTaskParams = {
        host: host.trim(),
        port,
        username: username.trim(),
        command: command.trim(),
      };
      if (password) params.password = password;
      if (privateKey) params.privateKey = privateKey;
      startTask(params);

      // Clear sensitive data from sessionStorage
      if (typeof window !== 'undefined') {
        const storage = window.sessionStorage;
        storage.removeItem(`${SSH_PREFIX}password`);
        storage.removeItem(`${SSH_PREFIX}private_key`);
        // Also clean local state
        setPassword('');
        setPrivateKey('');
      }
    }, 500);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]);

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!isConnected) return;

      const params: SshTaskParams = {
        host: host.trim(),
        port,
        username: username.trim(),
        command: command.trim(),
      };
      if (password) params.password = password;
      if (privateKey) params.privateKey = privateKey;

      startTask(params);
      autoStartedRef.current = true;
    },
    [isConnected, host, port, username, password, privateKey, command, startTask],
  );

  const canSubmit =
    isConnected && !isRunning && host.trim() && username.trim() && command.trim();

  const getLogLineClass = (entry: LogEntry): string => {
    switch (entry.type) {
      case 'stderr':
        return 'text-amber-400';
      case 'error':
        return 'text-red-400';
      case 'info':
        return 'text-[#8B8FA3]';
      default:
        return 'text-[#C8CAD0]';
    }
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Label className="text-[#8B8FA3] text-xs uppercase tracking-wider">
          远程算力连接
        </Label>
        <Badge
          variant={isConnected ? 'default' : 'secondary'}
          className={`text-xs ${
            isConnected
              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
          }`}
        >
          {isConnected ? '已连接' : '未连接'}
        </Badge>
      </div>

      {/* SSH Connection Form */}
      <form onSubmit={handleSubmit} className="space-y-2">
        {/* Host */}
        <div className="space-y-1">
          <Label className="text-[#8B8FA3] text-xs">主机</Label>
          <input
            type="text"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="例如: 192.168.1.100"
            disabled={isRunning}
            className="w-full px-2.5 py-1.5 text-sm bg-[#1A1A2E]/70 border border-[#2A3A5C] rounded text-white placeholder-[#4A4A6A] focus:outline-none focus:border-[#E8B931]/50 disabled:opacity-50"
          />
        </div>

        {/* Port */}
        <div className="space-y-1">
          <Label className="text-[#8B8FA3] text-xs">端口</Label>
          <input
            type="number"
            value={port}
            onChange={(e) => setPort(parseInt(e.target.value, 10) || 22)}
            disabled={isRunning}
            min={1}
            max={65535}
            className="w-full px-2.5 py-1.5 text-sm bg-[#1A1A2E]/70 border border-[#2A3A5C] rounded text-white placeholder-[#4A4A6A] focus:outline-none focus:border-[#E8B931]/50 disabled:opacity-50"
          />
        </div>

        {/* Username */}
        <div className="space-y-1">
          <Label className="text-[#8B8FA3] text-xs">用户名</Label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="例如: root"
            disabled={isRunning}
            autoComplete="off"
            className="w-full px-2.5 py-1.5 text-sm bg-[#1A1A2E]/70 border border-[#2A3A5C] rounded text-white placeholder-[#4A4A6A] focus:outline-none focus:border-[#E8B931]/50 disabled:opacity-50"
          />
        </div>

        {/* Password */}
        <div className="space-y-1">
          <Label className="text-[#8B8FA3] text-xs">
            密码
            <span className="text-[#4A4A6A] ml-1">(与私钥二选一)</span>
          </Label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="输入 SSH 密码"
              disabled={isRunning}
              autoComplete="new-password"
              className="w-full px-2.5 py-1.5 pr-16 text-sm bg-[#1A1A2E]/70 border border-[#2A3A5C] rounded text-white placeholder-[#4A4A6A] focus:outline-none focus:border-[#E8B931]/50 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-1 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] text-[#4A4A6A] hover:text-[#8B8FA3] transition-colors"
            >
              {showPassword ? '隐藏' : '显示'}
            </button>
          </div>
        </div>

        {/* Private Key */}
        <div className="space-y-1">
          <Label className="text-[#8B8FA3] text-xs">
            私钥
            <span className="text-[#4A4A6A] ml-1">(与密码二选一)</span>
          </Label>
          <div className="relative">
            <textarea
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              placeholder="粘贴 SSH 私钥内容..."
              disabled={isRunning}
              rows={showKey ? 6 : 2}
              className="w-full px-2.5 py-1.5 text-sm bg-[#1A1A2E]/70 border border-[#2A3A5C] rounded text-white placeholder-[#4A4A6A] focus:outline-none focus:border-[#E8B931]/50 disabled:opacity-50 resize-none font-mono text-xs"
            />
            {privateKey && (
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-1 bottom-1 px-1.5 py-0.5 text-[10px] text-[#4A4A6A] hover:text-[#8B8FA3] transition-colors"
              >
                {showKey ? '收起' : '展开'}
              </button>
            )}
          </div>
        </div>

        {/* Command */}
        <div className="space-y-1">
          <Label className="text-[#8B8FA3] text-xs">启动命令</Label>
          <textarea
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="例如: ls -la /data"
            disabled={isRunning}
            rows={3}
            className="w-full px-2.5 py-1.5 text-sm bg-[#1A1A2E]/70 border border-[#2A3A5C] rounded text-white placeholder-[#4A4A6A] focus:outline-none focus:border-[#E8B931]/50 disabled:opacity-50 resize-none font-mono text-xs"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={!canSubmit}
          className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            isRunning
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 cursor-not-allowed'
              : canSubmit
                ? 'bg-[#E8B931] hover:bg-[#E8B931]/90 text-[#1A1A2E]'
                : 'bg-[#2A3A5C]/50 text-[#4A4A6A] cursor-not-allowed'
          }`}
        >
          {isRunning ? '任务运行中...' : '提交任务'}
        </button>
      </form>

      {/* Error Display */}
      {error && (
        <div className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded px-2 py-1.5">
          {error}
        </div>
      )}

      {/* Log Output */}
      {logs.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-[#8B8FA3] text-xs">终端输出</Label>
          <div className="bg-[#0D0D1A] border border-[#2A3A5C]/50 rounded overflow-hidden">
            <div className="max-h-[300px] overflow-y-auto p-2.5 scrollbar-thin">
              <pre className="text-xs font-mono leading-relaxed whitespace-pre-wrap break-all text-[#C8CAD0] m-0">
                {logs.map((entry, i) => (
                  <span
                    key={`${entry.timestamp}-${i}`}
                    className={getLogLineClass(entry)}
                  >
                    {entry.data}
                  </span>
                ))}
              </pre>
              <div ref={logEndRef} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
