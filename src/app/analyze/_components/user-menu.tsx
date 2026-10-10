'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { ChevronDown, ChevronRight, Loader2, Wallet, CreditCard, LogOut, Crown, RefreshCw } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// ---------- Types ----------

interface UsageItem {
  id: string;
  startedAt: string;
  duration: number;
  totalCost: number;
  gpus: string | null;
  gpuType: string | null;
}

interface CreditItem {
  id: string;
  amount: number;
  creditType: string;
  source: string | null;
  createdAt: string;
}

/** /api/cluster/balance 返回的余额，单位：元 */
interface BalanceInfo {
  remainingBalance: number;
}

interface MembershipProduct {
  name: string;
  type: string;
  /** 价格，单位：分 */
  price: number;
}

interface PayOrder {
  id: string;
  paidStatus: 'PENDING' | 'SUCCESS' | 'FAIL';
  errorMessage: string | null;
  nativePayRequest?: { codeURL: string };
}

// ---------- Helpers ----------

/** 同源请求，会话由 httpOnly Cookie 自动携带，前端不再持有 token。 */
async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const resp = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  });
  let data: unknown = null;
  try {
    data = await resp.json();
  } catch {
    data = null;
  }
  if (!resp.ok) {
    const err = data as { error?: string; key?: string } | null;
    throw new Error(err?.error || err?.key || `请求失败 (${resp.status})`);
  }
  return data as T;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

function formatDateTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function formatDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return `${h}小时${m}分`;
  if (m > 0) return `${m}分${ss}秒`;
  return `${ss}秒`;
}

/** 分 -> 元，保留角分 */
function formatYuanFromFen(fen: number): string {
  return (fen / 100).toFixed(2);
}

const SOURCE_LABELS: Record<string, string> = {
  PAYMENT: '现金',
  GIFT: '赠送',
  COUPON: '优惠券',
  PURCHASE_PRODUCT: '购买产品',
};

/**
 * 支付成功后刷新会员信息与余额。会话走同源 Cookie，无需携带 token。
 * 通过 window 事件广播，便于同时打开的余额视图即时更新。
 */
async function refreshAccountState(): Promise<void> {
  try {
    const [me, balance] = await Promise.all([
      api<Record<string, unknown>>('/api/auth/me').catch(() => null),
      api<BalanceInfo>('/api/cluster/balance').catch(() => null),
    ]);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('zhizi:account-updated', { detail: { me, balance } }),
      );
    }
  } catch {
    /* 刷新失败不影响支付结果展示 */
  }
}

// ---------- WeChat QR code ----------

function PayQrCode({ codeURL }: { codeURL: string }) {
  const [src, setSrc] = useState<string>('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setFailed(false);
    setSrc('');
    // codeURL 形如 weixin://wxpay/bizpayurl?pr=...，必须原样编码进二维码，
    // 不做 URL 编码、不改写、不能当网页打开。
    QRCode.toDataURL(codeURL, { width: 220, margin: 1, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (active) setSrc(url);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [codeURL]);

  if (failed) {
    return (
      <p className="text-xs text-[#FF6B6B] text-center">
        二维码生成失败，请关闭后重试
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="bg-white p-2 rounded-lg">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="微信支付二维码" width={200} height={200} />
        ) : (
          <div className="w-[200px] h-[200px] flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#8B8FA3]" />
          </div>
        )}
      </div>
      <p className="text-[10px] text-[#8B8FA3]">请用微信扫码完成支付</p>
    </div>
  );
}

// ---------- Payment polling hook ----------

function useOrderPolling(
  orderId: string | null,
  onDone: (order: PayOrder) => void,
) {
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    const timer = setInterval(async () => {
      try {
        const order = await api<PayOrder>(`/api/pay/orders/${orderId}`);
        if (!cancelled && order.paidStatus !== 'PENDING') {
          clearInterval(timer);
          onDoneRef.current(order);
        }
      } catch {
        // keep polling
      }
    }, 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [orderId]);
}

/** 创建支付订单；超时后不自动重试（官方不保证幂等），把控制权交回用户。 */
async function createOrder(body: Record<string, unknown>): Promise<PayOrder> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    return await api<PayOrder>('/api/pay/orders', {
      method: 'POST',
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error('创建订单超时，请手动重试');
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// ---------- Consumption dialog ----------

interface ConsumptionDialogProps {
  open: boolean;
  onClose: () => void;
}

function ConsumptionDialog({ open, onClose }: ConsumptionDialogProps) {
  const [usages, setUsages] = useState<UsageItem[]>([]);
  const [credits, setCredits] = useState<CreditItem[]>([]);
  const [remainingBalanceYuan, setRemainingBalanceYuan] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [u, c, b] = await Promise.all([
        api<{ items: UsageItem[] }>('/api/cluster/usage/my-usages?page=0&pageSize=50'),
        api<{ items: CreditItem[] }>('/api/cluster/credit/my-credits?page=0&pageSize=50'),
        api<BalanceInfo>('/api/cluster/balance'),
      ]);
      setUsages(u.items ?? []);
      setCredits(c.items ?? []);
      setRemainingBalanceYuan(typeof b?.remainingBalance === 'number' ? b.remainingBalance : null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  // 支付成功后若本弹窗打开，余额即时刷新
  useEffect(() => {
    const handler = () => {
      if (open) load();
    };
    window.addEventListener('zhizi:account-updated', handler);
    return () => window.removeEventListener('zhizi:account-updated', handler);
  }, [open, load]);

  const rows = useMemo(() => {
    const usageRows = usages.map((u) => ({
      key: `u-${u.id}`,
      ts: new Date(u.startedAt).getTime(),
      big: formatDuration(u.duration),
      small: `${u.gpuType ?? ''}${u.gpus ? ` · ${u.gpus}` : ''}`,
      amount: `-${u.totalCost.toFixed(2)}`,
      amountClass: 'text-[#FF6B6B]',
    }));
    const creditRows = credits.map((c) => ({
      key: `c-${c.id}`,
      ts: new Date(c.createdAt).getTime(),
      big: SOURCE_LABELS[c.source ?? ''] ?? c.source ?? c.creditType ?? '充值',
      small: '',
      amount: `+${c.amount.toFixed(2)}`,
      amountClass: 'text-[#4ADE80]',
    }));
    return [...usageRows, ...creditRows].sort((a, b) => b.ts - a.ts);
  }, [usages, credits]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="bg-[#16213E] rounded-lg p-5 w-full max-w-[420px] border border-[#2A3A5C] shadow-xl max-h-[80vh] flex flex-col">
        <h3 className="text-sm font-bold text-[#E8B931] mb-3 shrink-0">消费记录</h3>

        {remainingBalanceYuan !== null && (
          <div className="shrink-0 mb-3 flex items-center justify-between bg-[#1A1A2E]/60 border border-[#2A3A5C]/50 rounded-lg px-4 py-3">
            <span className="text-xs text-[#8B8FA3]">当前余额</span>
            <span className="text-lg font-bold text-[#E8B931]">¥{remainingBalanceYuan.toFixed(2)}</span>
          </div>
        )}

        {error && <p className="text-xs text-[#FF6B6B] mb-3 shrink-0">{error}</p>}

        {loading ? (
          <div className="py-10 text-center text-[#8B8FA3] text-sm">加载中...</div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-[#8B8FA3] text-sm">暂无记录</div>
        ) : (
          <div className="overflow-y-auto -mx-1 flex-1 min-h-0">
            {rows.map((row) => (
              <div
                key={row.key}
                className="flex items-center justify-between px-3 py-2.5 rounded hover:bg-[#2A3A5C]/40 transition-colors"
              >
                <div className="flex-1 min-w-0 pr-3">
                  <p className="text-sm font-medium text-[#E0E0E0]">{row.big}</p>
                  {row.small && (
                    <p className="text-xs text-[#8B8FA3] mt-0.5">{row.small}</p>
                  )}
                  <p className="text-[10px] text-[#4A4A6A] mt-0.5">
                    {formatDateTime(row.ts)}
                  </p>
                </div>
                <div className={cn('text-base font-bold shrink-0 self-center', row.amountClass)}>
                  {row.amount}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 mt-4 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 px-3 py-2 text-sm bg-[#2A3A5C]/50 hover:bg-[#2A3A5C] text-[#8B8FA3] rounded transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- VIP dialog ----------

interface VipDialogProps {
  open: boolean;
  onClose: () => void;
}

const PRODUCT_LABELS: Record<string, string> = {
  MEMBERSHIP_1_MONTH: '1个月',
  MEMBERSHIP_3_MONTH: '3个月',
  MEMBERSHIP_6_MONTH: '6个月',
  MEMBERSHIP_12_MONTH: '12个月',
};

function VipDialog({ open, onClose }: VipDialogProps) {
  const [products, setProducts] = useState<MembershipProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<MembershipProduct | null>(null);
  const [paying, setPaying] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [codeURL, setCodeURL] = useState('');
  const [payStatus, setPayStatus] = useState<'PENDING' | 'SUCCESS' | 'FAIL'>('PENDING');
  const [payError, setPayError] = useState('');

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api<MembershipProduct[]>('/api/cluster/product?type=MEMBERSHIP');
      setProducts(Array.isArray(data) ? data.filter((p) => p.type === 'MEMBERSHIP') : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '加载产品失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setSelected(null);
      setOrderId(null);
      setCodeURL('');
      setPayStatus('PENDING');
      setPayError('');
      setPaying(false);
      loadProducts();
    }
  }, [open, loadProducts]);

  useOrderPolling(open ? orderId : null, (order) => {
    setPayStatus(order.paidStatus);
    if (order.paidStatus === 'SUCCESS') {
      refreshAccountState();
    } else {
      // 用本地文案，不把上游 errorMessage 原文丢给用户
      setPayError('支付失败，请重试');
    }
    setPaying(false);
    setOrderId(null);
  });

  const handlePay = async () => {
    if (!selected || paying) return;
    setPaying(true);
    setPayError('');
    try {
      const priceFen = selected.price;
      const order = await createOrder({
        payType: 'WECHAT',
        amount: priceFen,
        tradeType: 'NATIVE',
        body: '智子围棋VIP会员',
        orderType: 'PURCHASE_PRODUCT',
        productName: selected.name,
        extraInfo: { autoRenew: false },
      });
      setCodeURL(order.nativePayRequest?.codeURL ?? '');
      setOrderId(order.id);
      setPayStatus('PENDING');
    } catch (e: unknown) {
      setPayError(e instanceof Error ? e.message : '创建订单失败');
      setPaying(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4">
      <div className="bg-[#16213E] rounded-lg p-5 w-full max-w-[420px] border border-[#2A3A5C] shadow-xl">
        <h3 className="text-sm font-bold text-[#E8B931] mb-3">VIP充值</h3>

        {error && (
          <div className="text-xs text-[#FF6B6B] mb-3 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={loadProducts} className="flex items-center gap-1 hover:text-[#E8B931]">
              <RefreshCw className="w-3 h-3" /> 重试
            </button>
          </div>
        )}

        {payError && <p className="text-xs text-[#FF6B6B] mb-3">{payError}</p>}

        {payStatus === 'SUCCESS' ? (
          <div className="py-8 text-center">
            <div className="text-lg font-bold text-[#4ADE80] mb-1">支付成功</div>
            <div className="text-xs text-[#8B8FA3]">VIP 会员已开通</div>
          </div>
        ) : loading ? (
          <div className="py-10 text-center text-[#8B8FA3] text-sm flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> 加载产品中...
          </div>
        ) : products.length === 0 ? (
          <div className="py-10 text-center text-[#8B8FA3] text-sm">暂无可用产品</div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2.5">
              {products.map((p) => {
                const label = PRODUCT_LABELS[p.name] ?? p.name;
                const priceYuan = formatYuanFromFen(p.price);
                const active = selected?.name === p.name;
                return (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => setSelected(p)}
                    disabled={!!orderId}
                    className={cn(
                      'rounded-lg border p-3 text-left transition-colors disabled:opacity-50',
                      active
                        ? 'border-[#E8B931] bg-[#E8B931]/10'
                        : 'border-[#2A3A5C]/60 bg-[#1A1A2E] hover:border-[#E8B931]/50',
                    )}
                  >
                    <div className="text-xs text-[#8B8FA3]">{label}</div>
                    <div className="text-lg font-bold text-[#E8B931] mt-1">¥{priceYuan}</div>
                  </button>
                );
              })}
            </div>

            {orderId && payStatus === 'PENDING' && codeURL ? (
              <div className="mt-4">
                <PayQrCode codeURL={codeURL} />
              </div>
            ) : (
              <button
                onClick={handlePay}
                disabled={!selected || paying || !!orderId}
                className="w-full mt-4 px-3 py-2.5 text-sm font-medium bg-[#E8B931] hover:bg-[#F5C84A] text-[#0F0F23] rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {paying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> 创建订单中...
                  </>
                ) : (
                  '去支付'
                )}
              </button>
            )}
          </>
        )}

        {orderId && payStatus === 'PENDING' && (
          <p className="text-[10px] text-[#8B8FA3] mt-2 text-center">
            请使用微信扫描二维码完成支付
          </p>
        )}

        <div className="flex gap-2 mt-4">
          <button
            onClick={onClose}
            className="flex-1 px-3 py-2 text-sm bg-[#2A3A5C]/50 hover:bg-[#2A3A5C] text-[#8B8FA3] rounded transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Recharge dialog ----------

interface RechargeDialogProps {
  open: boolean;
  onClose: () => void;
}

const QUICK_AMOUNTS_YUAN = [5, 10, 20, 50, 100];

function RechargeDialog({ open, onClose }: RechargeDialogProps) {
  const [amountYuan, setAmountYuan] = useState('');
  const [paying, setPaying] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [codeURL, setCodeURL] = useState('');
  const [payStatus, setPayStatus] = useState<'PENDING' | 'SUCCESS' | 'FAIL'>('PENDING');
  const [payError, setPayError] = useState('');
  const [showVip, setShowVip] = useState(false);

  useEffect(() => {
    if (open) {
      setAmountYuan('');
      setOrderId(null);
      setCodeURL('');
      setPayStatus('PENDING');
      setPayError('');
      setPaying(false);
    }
  }, [open]);

  useOrderPolling(open ? orderId : null, (order) => {
    setPayStatus(order.paidStatus);
    if (order.paidStatus === 'SUCCESS') {
      refreshAccountState();
    } else {
      setPayError('支付失败，请重试');
    }
    setPaying(false);
    setOrderId(null);
  });

  const handlePay = async () => {
    const yuan = parseFloat(amountYuan);
    if (!Number.isFinite(yuan) || yuan <= 0) {
      setPayError('请输入有效的充值金额');
      return;
    }
    if (yuan > 100000) {
      setPayError('单次充值金额过大');
      return;
    }
    const amountFen = Math.round(yuan * 100);
    setPaying(true);
    setPayError('');
    try {
      const order = await createOrder({
        payType: 'WECHAT',
        amount: amountFen,
        tradeType: 'NATIVE',
        body: '智子围棋账户充值',
      });
      setCodeURL(order.nativePayRequest?.codeURL ?? '');
      setOrderId(order.id);
      setPayStatus('PENDING');
    } catch (e: unknown) {
      setPayError(e instanceof Error ? e.message : '创建订单失败');
      setPaying(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/60 px-4">
      <div className="bg-[#16213E] rounded-lg p-5 w-full max-w-[420px] border border-[#2A3A5C] shadow-xl">
        {/* Top 3/4: balance recharge */}
        <div className="pb-4 border-b border-[#2A3A5C]/50">
          <h3 className="text-sm font-bold text-[#E8B931] mb-3">充值余额</h3>

          {payError && <p className="text-xs text-[#FF6B6B] mb-3">{payError}</p>}

          {payStatus === 'SUCCESS' ? (
            <div className="py-6 text-center">
              <div className="text-lg font-bold text-[#4ADE80] mb-1">支付成功</div>
              <div className="text-xs text-[#8B8FA3]">余额已到账</div>
            </div>
          ) : orderId && payStatus === 'PENDING' && codeURL ? (
            <div className="py-2">
              <PayQrCode codeURL={codeURL} />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-5 gap-2 mb-3">
                {QUICK_AMOUNTS_YUAN.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setAmountYuan(String(q))}
                    className={cn(
                      'px-1 py-2 text-xs rounded border transition-colors',
                      amountYuan === String(q)
                        ? 'border-[#E8B931] bg-[#E8B931]/10 text-[#E8B931]'
                        : 'border-[#2A3A5C]/60 bg-[#1A1A2E] text-[#C8CAD0] hover:border-[#E8B931]/50',
                    )}
                  >
                    ¥{q}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-[#8B8FA3] shrink-0">自定义</span>
                <div className="relative flex-1">
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={amountYuan}
                    onChange={(e) => setAmountYuan(e.target.value)}
                    placeholder="输入金额"
                    className="h-9 w-full text-sm bg-[#1A1A2E] border-[#2A3A5C]/60 text-[#E0E0E0] placeholder:text-[#4A4A6A] focus-visible:ring-[#E8B931]/30 pr-7 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#4A4A6A]">¥</span>
                </div>
              </div>

              <button
                onClick={handlePay}
                disabled={paying || !!orderId}
                className="w-full px-3 py-2.5 text-sm font-medium bg-[#07C160] hover:bg-[#06AD56] text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {paying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> 创建订单中...
                  </>
                ) : (
                  <>
                    <Wallet className="w-4 h-4" /> 微信支付
                  </>
                )}
              </button>

              {orderId && payStatus === 'PENDING' && (
                <p className="text-[10px] text-[#8B8FA3] mt-2 text-center">
                  请使用微信扫描二维码完成支付
                </p>
              )}
            </>
          )}
        </div>

        {/* Bottom 1/4: VIP recharge */}
        <div className="pt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="w-4 h-4 text-[#E8B931]" />
            <span className="text-sm font-medium text-[#E0E0E0]">VIP充值</span>
          </div>
          <button
            onClick={() => setShowVip(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[#E8B931]/15 hover:bg-[#E8B931]/25 text-[#E8B931] rounded transition-colors"
          >
            前往充值
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex gap-2 mt-4">
          <button
            onClick={onClose}
            className="flex-1 px-3 py-2 text-sm bg-[#2A3A5C]/50 hover:bg-[#2A3A5C] text-[#8B8FA3] rounded transition-colors"
          >
            关闭
          </button>
        </div>
      </div>

      <VipDialog open={showVip} onClose={() => setShowVip(false)} />
    </div>
  );
}

// ---------- User menu ----------

interface UserMenuProps {
  userDisplayName: string;
  onLogout: () => void;
}

export function UserMenu({ userDisplayName, onLogout }: UserMenuProps) {
  const [showConsumption, setShowConsumption] = useState(false);
  const [showRecharge, setShowRecharge] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="text-xs text-[#8B8FA3] hover:text-[#E8B931] transition-colors flex items-center gap-0.5 max-w-[120px]"
            title={userDisplayName}
          >
            <span className="truncate">{userDisplayName}</span>
            <ChevronDown className="w-3 h-3 shrink-0 text-[#4A4A6A]" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="bg-[#1A1A2E] border-[#2A3A5C]/60 min-w-[8rem] z-[70]"
        >
          <DropdownMenuItem
            onClick={() => setShowConsumption(true)}
            className="text-xs text-[#E0E0E0] hover:bg-[#16213E] cursor-pointer flex items-center gap-2"
          >
            <CreditCard className="w-3.5 h-3.5 text-[#8B8FA3]" />
            消费记录
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setShowRecharge(true)}
            className="text-xs text-[#E0E0E0] hover:bg-[#16213E] cursor-pointer flex items-center gap-2"
          >
            <Wallet className="w-3.5 h-3.5 text-[#8B8FA3]" />
            充值
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={onLogout}
            className="text-xs text-[#FF6B6B] hover:bg-[#FF6B6B]/10 cursor-pointer flex items-center gap-2 border-t border-[#2A3A5C]/40"
          >
            <LogOut className="w-3.5 h-3.5" />
            退出
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConsumptionDialog open={showConsumption} onClose={() => setShowConsumption(false)} />
      <RechargeDialog open={showRecharge} onClose={() => setShowRecharge(false)} />
    </>
  );
}
