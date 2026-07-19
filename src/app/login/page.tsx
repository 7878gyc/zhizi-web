'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { saveToken } from '@/lib/auth';

const MODE_KEY = 'zhizi_analysis_mode';
const SSH_PREFIX = 'zhizi_ssh_';

export default function LoginPage() {
  const router = useRouter();

  // --- Zhizi login state ---
  const [loginType, setLoginType] = useState<'phone' | 'email'>('phone');
  const [authMode, setAuthMode] = useState<'password' | 'code'>('password');
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [error, setError] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // --- View toggle ---
  const [showSshForm, setShowSshForm] = useState(false);

  // --- SSH form state ---
  const [sshHost, setSshHost] = useState('');
  const [sshPort, setSshPort] = useState('22');
  const [sshUser, setSshUser] = useState('');
  const [sshPassword, setSshPassword] = useState('');
  const [sshKey, setSshKey] = useState('');
  const [sshCommand, setSshCommand] = useState('');
  const [sshError, setSshError] = useState('');

  // ===== Zhizi login handlers =====

  const handleLogin = async () => {
    setError('');
    if (authMode === 'password') {
      if (!account || !password) {
        setError('请填写账号和密码');
        return;
      }
    } else {
      if (!account || !verificationCode) {
        setError('请填写账号和验证码');
        return;
      }
    }
    setLoading(true);
    try {
      let body: Record<string, string>;
      let endpoint = '/api/auth/login';

      if (authMode === 'password') {
        body = loginType === 'phone'
          ? { phone: account, password }
          : { email: account, password };
      } else {
        endpoint = '/api/auth/fast-login';
        body = loginType === 'phone'
          ? { phone: account, verificationCode }
          : { email: account, verificationCode };
      }

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await resp.json();

      if (!resp.ok) {
        setError(data.key || data.message || data.error || '登录失败');
        return;
      }

      if (data.token) {
        saveToken(data.token);
        localStorage.setItem(MODE_KEY, 'local');
        router.push('/');
      } else {
        setError('登录返回异常，未获取到令牌');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '网络错误');
    } finally {
      setLoading(false);
    }
  };

  const handleSendCode = async () => {
    setError('');
    if (!account) {
      setError(loginType === 'phone' ? '请填写手机号' : '请填写邮箱');
      return;
    }
    setSendingCode(true);
    try {
      const body = loginType === 'phone'
        ? { phone: account, type: 'fast_login' }
        : { email: account, type: 'fast_login' };

      const resp = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await resp.json();

      if (!resp.ok) {
        setError(data.key || data.message || data.error || '发送验证码失败');
        return;
      }

      setCodeSent(true);
      setCountdown(60);
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '网络错误');
    } finally {
      setSendingCode(false);
    }
  };

  // ===== SSH form handler =====

  const handleSshConnect = () => {
    setSshError('');
    if (!sshHost.trim()) {
      setSshError('请输入主机地址');
      return;
    }
    if (!sshUser.trim()) {
      setSshError('请输入用户名');
      return;
    }
    if (!sshCommand.trim()) {
      setSshError('请输入启动命令');
      return;
    }

    // Store SSH config in sessionStorage
    const storage = typeof window !== 'undefined' ? window.sessionStorage : null;
    if (storage) {
      storage.setItem(`${SSH_PREFIX}host`, sshHost.trim());
      storage.setItem(`${SSH_PREFIX}port`, sshPort || '22');
      storage.setItem(`${SSH_PREFIX}username`, sshUser.trim());
      if (sshPassword) storage.setItem(`${SSH_PREFIX}password`, sshPassword);
      if (sshKey) storage.setItem(`${SSH_PREFIX}private_key`, sshKey);
      storage.setItem(`${SSH_PREFIX}command`, sshCommand.trim());
    }
    localStorage.setItem(MODE_KEY, 'remote');
    router.push('/');
  };

  // ===== Shared header =====

  const header = (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <div className="w-14 h-14 rounded-full bg-[#1A1A1A] shadow-lg flex items-center justify-center">
          <div className="w-3 h-3 rounded-full bg-white/80 absolute top-3 left-4" />
        </div>
        <div className="w-10 h-10 rounded-full bg-[#F0F0F0] shadow-md absolute -bottom-2 -right-3 border border-gray-300/50">
          <div className="w-2 h-2 rounded-full bg-black/10 absolute top-2 right-2" />
        </div>
      </div>
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[#E8B931] tracking-wide">智子围棋 AI</h1>
        <p className="text-[#8B8FA3] text-sm mt-1">
          {showSshForm ? '远程算力连接' : 'GPU 算力围棋分析平台'}
        </p>
      </div>
    </div>
  );

  // ===== Zhizi login form =====

  const zhiziForm = (
    <>
      {/* Login type tabs */}
      <div className="flex mb-4 bg-[#1A1A2E]/50 rounded-lg p-1">
        <button
          onClick={() => { setLoginType('phone'); setAccount(''); setError(''); }}
          className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
            loginType === 'phone'
              ? 'bg-[#E8B931] text-[#1A1A2E]'
              : 'text-[#8B8FA3] hover:text-white'
          }`}
        >
          手机号
        </button>
        <button
          onClick={() => { setLoginType('email'); setAccount(''); setError(''); }}
          className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
            loginType === 'email'
              ? 'bg-[#E8B931] text-[#1A1A2E]'
              : 'text-[#8B8FA3] hover:text-white'
          }`}
        >
          邮箱
        </button>
      </div>

      {/* Auth mode tabs */}
      <div className="flex mb-6 bg-[#1A1A2E]/50 rounded-lg p-1">
        <button
          onClick={() => { setAuthMode('password'); setError(''); }}
          className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
            authMode === 'password'
              ? 'bg-[#2A3A5C] text-white'
              : 'text-[#8B8FA3] hover:text-white'
          }`}
        >
          密码登录
        </button>
        <button
          onClick={() => { setAuthMode('code'); setError(''); }}
          className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
            authMode === 'code'
              ? 'bg-[#2A3A5C] text-white'
              : 'text-[#8B8FA3] hover:text-white'
          }`}
        >
          验证码登录
        </button>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-[#8B8FA3] text-xs">
            {loginType === 'phone' ? '手机号' : '邮箱地址'}
          </Label>
          <Input
            type={loginType === 'phone' ? 'tel' : 'email'}
            placeholder={loginType === 'phone' ? '请输入手机号' : '请输入邮箱地址'}
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            className="bg-[#1A1A2E]/70 border-[#2A3A5C] text-white placeholder:text-[#4A4A6A] focus:border-[#E8B931] focus:ring-[#E8B931]/20"
            onKeyDown={(e) => { if (e.key === 'Enter') handleLogin(); }}
          />
        </div>

        {authMode === 'password' ? (
          <div className="space-y-2">
            <Label className="text-[#8B8FA3] text-xs">密码</Label>
            <Input
              type="password"
              placeholder="请输入密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-[#1A1A2E]/70 border-[#2A3A5C] text-white placeholder:text-[#4A4A6A] focus:border-[#E8B931] focus:ring-[#E8B931]/20"
              onKeyDown={(e) => { if (e.key === 'Enter') handleLogin(); }}
            />
          </div>
        ) : (
          <div className="space-y-2">
            <Label className="text-[#8B8FA3] text-xs">验证码</Label>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="请输入验证码"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                className="flex-1 bg-[#1A1A2E]/70 border-[#2A3A5C] text-white placeholder:text-[#4A4A6A] focus:border-[#E8B931] focus:ring-[#E8B931]/20"
                onKeyDown={(e) => { if (e.key === 'Enter') handleLogin(); }}
              />
              <Button
                onClick={handleSendCode}
                disabled={sendingCode || countdown > 0}
                className="px-4 bg-[#2A3A5C] hover:bg-[#2A3A5C]/80 text-white text-sm whitespace-nowrap"
              >
                {sendingCode ? '发送中...' : countdown > 0 ? `${countdown}s` : codeSent ? '重新发送' : '发送验证码'}
              </Button>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2 text-red-400 text-sm">
            {error}
          </div>
        )}

        <Button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-[#E8B931] hover:bg-[#D4A52A] text-[#1A1A2E] font-semibold h-11 transition-all"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-[#1A1A2E]/30 border-t-[#1A1A2E] rounded-full animate-spin" />
              登录中...
            </span>
          ) : (
            '登录'
          )}
        </Button>
      </div>

      <p className="text-center text-[#4A4A6A] text-xs mt-6">
        登录即表示同意智子围棋的服务条款
      </p>

      {/* SSH switch link — bottom right */}
      <div className="flex justify-end mt-3">
        <button
          onClick={() => { setShowSshForm(true); setError(''); }}
          className="text-[10px] text-[#4A4A6A] hover:text-[#E8B931] transition-colors"
        >
          通过 SSH 连接
        </button>
      </div>
    </>
  );

  // ===== SSH connection form =====

  const sshForm = (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-[#8B8FA3] text-xs">主机地址</Label>
        <input
          type="text"
          value={sshHost}
          onChange={(e) => setSshHost(e.target.value)}
          placeholder="例如: 192.168.1.100"
          className="w-full px-2.5 py-1.5 text-sm bg-[#1A1A2E]/70 border border-[#2A3A5C] rounded text-white placeholder-[#4A4A6A] focus:outline-none focus:border-[#E8B931]/50"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-[#8B8FA3] text-xs">端口</Label>
        <input
          type="number"
          value={sshPort}
          onChange={(e) => setSshPort(e.target.value)}
          min={1}
          max={65535}
          className="w-full px-2.5 py-1.5 text-sm bg-[#1A1A2E]/70 border border-[#2A3A5C] rounded text-white placeholder-[#4A4A6A] focus:outline-none focus:border-[#E8B931]/50"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-[#8B8FA3] text-xs">用户名</Label>
        <input
          type="text"
          value={sshUser}
          onChange={(e) => setSshUser(e.target.value)}
          placeholder="例如: root"
          autoComplete="off"
          className="w-full px-2.5 py-1.5 text-sm bg-[#1A1A2E]/70 border border-[#2A3A5C] rounded text-white placeholder-[#4A4A6A] focus:outline-none focus:border-[#E8B931]/50"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-[#8B8FA3] text-xs">
          密码
          <span className="text-[#4A4A6A] ml-1">(与密钥二选一)</span>
        </Label>
        <input
          type="password"
          value={sshPassword}
          onChange={(e) => setSshPassword(e.target.value)}
          placeholder="输入 SSH 密码"
          autoComplete="new-password"
          className="w-full px-2.5 py-1.5 text-sm bg-[#1A1A2E]/70 border border-[#2A3A5C] rounded text-white placeholder-[#4A4A6A] focus:outline-none focus:border-[#E8B931]/50"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-[#8B8FA3] text-xs">
          私钥
          <span className="text-[#4A4A6A] ml-1">(与密码二选一)</span>
        </Label>
        <textarea
          value={sshKey}
          onChange={(e) => setSshKey(e.target.value)}
          placeholder="粘贴 SSH 私钥内容..."
          rows={3}
          className="w-full px-2.5 py-1.5 text-xs bg-[#1A1A2E]/70 border border-[#2A3A5C] rounded text-white placeholder-[#4A4A6A] focus:outline-none focus:border-[#E8B931]/50 resize-none font-mono"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-[#8B8FA3] text-xs">启动命令</Label>
        <textarea
          value={sshCommand}
          onChange={(e) => setSshCommand(e.target.value)}
          placeholder="例如: kata-analyze ..."
          rows={3}
          className="w-full px-2.5 py-1.5 text-xs bg-[#1A1A2E]/70 border border-[#2A3A5C] rounded text-white placeholder-[#4A4A6A] focus:outline-none focus:border-[#E8B931]/50 resize-none font-mono"
        />
      </div>

      {sshError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2 text-red-400 text-xs">
          {sshError}
        </div>
      )}

      <Button
        onClick={handleSshConnect}
        className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-semibold h-11 transition-all flex items-center justify-center gap-2"
      >
        <Terminal className="w-4 h-4" />
        连接远程算力
      </Button>

      {/* Zhizi switch link — bottom left */}
      <div className="flex justify-start mt-3">
        <button
          onClick={() => { setShowSshForm(false); setSshError(''); }}
          className="text-[10px] text-[#4A4A6A] hover:text-[#E8B931] transition-colors"
        >
          通过智子连接
        </button>
      </div>
    </div>
  );

  // ===== Render =====

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1A1A2E] relative overflow-hidden">
      {/* Background decoration - Go board grid pattern */}
      <div className="absolute inset-0 opacity-[0.03]">
        <svg width="100%" height="100%">
          {Array.from({ length: 20 }).map((_, i) => (
            <g key={i}>
              <line x1={`${(i + 1) * 5}%`} y1="0" x2={`${(i + 1) * 5}%`} y2="100%" stroke="white" strokeWidth="1" />
              <line x1="0" y1={`${(i + 1) * 5}%`} x2="100%" y2={`${(i + 1) * 5}%`} stroke="white" strokeWidth="1" />
            </g>
          ))}
        </svg>
      </div>

      {/* Floating Go stones decoration */}
      <div className="absolute top-[15%] left-[10%] w-16 h-16 rounded-full bg-white/5 shadow-lg" />
      <div className="absolute top-[25%] right-[15%] w-12 h-12 rounded-full bg-white/10 shadow-lg" />
      <div className="absolute bottom-[20%] left-[20%] w-10 h-10 rounded-full bg-white/8 shadow-lg" />
      <div className="absolute bottom-[30%] right-[8%] w-20 h-20 rounded-full bg-white/[0.03] shadow-lg" />

      <Card className="w-full max-w-md bg-[#16213E]/90 border-[#2A3A5C] backdrop-blur-sm shadow-2xl">
        <CardHeader className="pb-2 pt-8 px-8">
          {header}
        </CardHeader>
        <CardContent className="px-8 pb-8 pt-4">
          {showSshForm ? sshForm : zhiziForm}
        </CardContent>
      </Card>
    </div>
  );
}
