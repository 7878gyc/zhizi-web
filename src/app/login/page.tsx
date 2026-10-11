'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { fetchCurrentUser, saveUser } from '@/lib/auth';
import { mapZhiziError } from '@/lib/zhizi-errors';

type AuthMode = 'password' | 'code' | 'register' | 'reset';

const MIN_PASSWORD_LENGTH = 8;

export default function LoginPage() {
  const router = useRouter();

  // 已登录用户不应停留在登录页，直接进入分析页
  useEffect(() => {
    let active = true;
    fetchCurrentUser().then((user) => {
      if (active && user) router.replace('/analyze');
    });
    return () => {
      active = false;
    };
  }, [router]);

  const [loginType, setLoginType] = useState<'phone' | 'email'>('phone');
  const [authMode, setAuthMode] = useState<AuthMode>('password');

  // 支持深链 ?mode=register|reset|code|password，供落地页 CTA 对准
  useEffect(() => {
    const mode = new URLSearchParams(window.location.search).get('mode');
    if (mode === 'register' || mode === 'reset' || mode === 'code' || mode === 'password') {
      setAuthMode(mode);
    }
  }, []);
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const isRegister = authMode === 'register';
  const isReset = authMode === 'reset';
  const needsPasswordField = authMode === 'password' || isRegister || isReset;
  const needsCodeField = authMode === 'code' || isRegister || isReset;

  const sendCodeType =
    authMode === 'register' ? 'register' : authMode === 'reset' ? 'reset_password' : 'fast_login';

  const switchMode = (mode: AuthMode) => {
    setAuthMode(mode);
    setError('');
    setSuccessMsg('');
    setPassword('');
    setVerificationCode('');
    setCodeSent(false);
    setCountdown(0);
  };

  const handleSubmit = async () => {
    setError('');
    setSuccessMsg('');

    if (!account) {
      setError(loginType === 'phone' ? '请填写手机号' : '请填写邮箱');
      return;
    }
    if (needsCodeField && !verificationCode) {
      setError('请填写验证码');
      return;
    }
    if (authMode === 'password' && !password) {
      setError('请填写密码');
      return;
    }
    if ((isRegister || isReset) && password.length < MIN_PASSWORD_LENGTH) {
      setError(`密码至少 ${MIN_PASSWORD_LENGTH} 位`);
      return;
    }

    setLoading(true);
    try {
      const accountField: Record<string, string> = loginType === 'phone' ? { phone: account } : { email: account };
      let endpoint = '/api/auth/login';
      let body: Record<string, string> = { ...accountField };

      switch (authMode) {
        case 'password':
          endpoint = '/api/auth/login';
          body = { ...accountField, password };
          break;
        case 'code':
          endpoint = '/api/auth/fast-login';
          body = { ...accountField, verificationCode };
          break;
        case 'register':
          endpoint = '/api/cluster/account/register';
          body = { ...accountField, verificationCode, password };
          break;
        case 'reset':
          endpoint = '/api/cluster/account/reset-password';
          body = { ...accountField, verificationCode, password };
          break;
      }

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await resp.json().catch(() => null);

      if (!resp.ok) {
        const fallback = isRegister ? '注册失败' : isReset ? '重置密码失败' : '登录失败';
        setError(mapZhiziError(data, fallback));
        return;
      }

      if (isRegister) {
        // 注册接口不一定自动登录：能拿到会话就进分析页，否则回到密码登录。
        const user = await fetchCurrentUser();
        if (user) {
          saveUser(user);
          router.push('/analyze');
        } else {
          switchMode('password');
          setSuccessMsg('注册成功，请使用密码登录');
        }
        return;
      }

      // 密码登录 / 验证码登录 / 找回密码成功后，会话 token 已由后端写入 Cookie
      if (data && typeof data === 'object') saveUser(data as Record<string, unknown>);
      router.push('/analyze');
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
        ? { phone: account, type: sendCodeType }
        : { email: account, type: sendCodeType };

      const resp = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await resp.json().catch(() => null);

      if (!resp.ok) {
        setError(mapZhiziError(data, '发送验证码失败'));
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

  const submitLabel = isRegister ? '注册' : isReset ? '重置密码' : authMode === 'code' ? '登录 / 注册' : '登录';
  const headerHint = isRegister
    ? '设置至少 8 位密码完成注册'
    : isReset
      ? '验证后设置新密码'
      : '';

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

          {/* Auth mode tabs (primary flows) */}
          {(authMode === 'password' || authMode === 'code') && (
            <div className="flex mb-6 bg-[#1A1A2E]/50 rounded-lg p-1">
              <button
                onClick={() => switchMode('password')}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                  authMode === 'password'
                    ? 'bg-[#2A3A5C] text-white'
                    : 'text-[#8B8FA3] hover:text-white'
                }`}
              >
                密码登录
              </button>
              <button
                onClick={() => switchMode('code')}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                  authMode === 'code'
                    ? 'bg-[#2A3A5C] text-white'
                    : 'text-[#8B8FA3] hover:text-white'
                }`}
              >
                验证码登录
              </button>
            </div>
          )}

          {(isRegister || isReset) && (
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-[#E8B931] font-medium">
                {isRegister ? '注册账号' : '找回密码'}
              </span>
              <button
                onClick={() => switchMode('password')}
                className="text-xs text-[#8B8FA3] hover:text-white"
              >
                {isRegister ? '已有账号？登录' : '返回登录'}
              </button>
            </div>
          )}

          {headerHint && (
            <p className="text-xs text-[#8B8FA3] mb-4">{headerHint}</p>
          )}

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
                onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
              />
            </div>

            {needsCodeField && (
              <div className="space-y-2">
                <Label className="text-[#8B8FA3] text-xs">验证码</Label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="请输入验证码"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    className="flex-1 bg-[#1A1A2E]/70 border-[#2A3A5C] text-white placeholder:text-[#4A4A6A] focus:border-[#E8B931] focus:ring-[#E8B931]/20"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
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

            {needsPasswordField && (
              <div className="space-y-2">
                <Label className="text-[#8B8FA3] text-xs">
                  {isRegister || isReset ? `密码（至少 ${MIN_PASSWORD_LENGTH} 位）` : '密码'}
                </Label>
                <Input
                  type="password"
                  placeholder={isRegister || isReset ? `请设置至少 ${MIN_PASSWORD_LENGTH} 位密码` : '请输入密码'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-[#1A1A2E]/70 border-[#2A3A5C] text-white placeholder:text-[#4A4A6A] focus:border-[#E8B931] focus:ring-[#E8B931]/20"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
                />
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2 text-red-400 text-sm">
                {error}
              </div>
            )}

            {successMsg && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-md px-3 py-2 text-emerald-400 text-sm">
                {successMsg}
              </div>
            )}

            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-[#E8B931] hover:bg-[#D4A52A] text-[#1A1A2E] font-semibold h-11 transition-all"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-[#1A1A2E]/30 border-t-[#1A1A2E] rounded-full animate-spin" />
                  处理中...
                </span>
              ) : (
                submitLabel
              )}
            </Button>

            {authMode === 'password' && (
              <div className="flex items-center justify-center gap-4 pt-1">
                <button
                  onClick={() => switchMode('register')}
                  className="text-xs text-[#8B8FA3] hover:text-[#E8B931] transition-colors"
                >
                  注册账号
                </button>
                <span className="text-[#2A3A5C]">|</span>
                <button
                  onClick={() => switchMode('reset')}
                  className="text-xs text-[#8B8FA3] hover:text-[#E8B931] transition-colors"
                >
                  找回密码
                </button>
              </div>
            )}
          </div>

          <p className="text-center text-[#4A4A6A] text-xs mt-6">
            登录即表示同意智子围棋的服务条款
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
