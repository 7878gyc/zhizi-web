import { NextRequest, NextResponse } from 'next/server';
import { callZhizi, getAuthToken, proxyZhizi } from '@/lib/zhizi-proxy';

const MAX_AMOUNT_FEN = 1_000_000; // 单笔上限 1 万元，防止误操作/异常金额

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/** 从上游会员产品列表里查服务端定价（分）。 */
async function resolveProductPrice(
  request: NextRequest,
  productName: string,
): Promise<number | null> {
  const result = await callZhizi(request, '/api/cluster/product', {
    method: 'GET',
    auth: false,
    query: 'type=MEMBERSHIP',
  });
  if (result.status < 200 || result.status >= 300) return null;

  const data = result.data;
  const list = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { items?: unknown }).items)
      ? (data as { items: unknown[] }).items
      : [];

  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const product = item as { name?: unknown; price?: unknown };
    const price = typeof product.price === 'string' ? Number(product.price) : product.price;
    if (product.name === productName && isPositiveInteger(price)) {
      return price;
    }
  }
  return null;
}

// POST /api/pay/orders
// 注意：官方明确创建订单不保证幂等，超时后不得自动重试，控制权交回用户。
export async function POST(request: NextRequest) {
  if (!getAuthToken(request)) {
    return NextResponse.json({ error: 'Not Authorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: '请求参数有误', key: 'invalid_data' }, { status: 400 });
  }

  const order = body as Record<string, unknown>;
  let amount = order.amount;

  // 会员/VIP 订单以服务端产品表价格为准，不信任客户端传来的 amount。
  if (typeof order.productName === 'string' && order.productName.trim()) {
    const price = await resolveProductPrice(request, order.productName);
    if (price === null) {
      return NextResponse.json(
        { error: '商品信息有误', key: 'invalid_product_name' },
        { status: 400 },
      );
    }
    amount = price;
  }

  if (!isPositiveInteger(amount) || amount > MAX_AMOUNT_FEN) {
    return NextResponse.json(
      { error: '支付金额有误', key: 'invalid_amount' },
      { status: 400 },
    );
  }

  return proxyZhizi(request, '/api/pay/orders', {
    method: 'POST',
    auth: true,
    body: { ...order, amount },
  });
}
