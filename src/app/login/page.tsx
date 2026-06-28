'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { saveToken } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
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
          <div className="flex flex-col items-center gap-4">
            {/* Go stone logo */}
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
              <p className="text-[#8B8FA3] text-sm mt-1">GPU 算力围棋分析平台</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-8 pb-8 pt-4">
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
        </CardContent>
      </Card>
    </div>
  );
}
