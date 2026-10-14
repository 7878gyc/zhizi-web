import { prisma } from '@/lib/prisma';
import {
  extractIdentifier,
  hashIdentifier,
  legacyHashIdentifier,
} from '@/lib/auth-server';

/**
 * 解析当前请求对应的「存储键」（DB 的 userHash 字段 + R2 路径前缀）。
 *
 * 兼容策略（老用户迁移渠道，零数据丢失）：
 * - 新增了 USER_HASH_SALT 后，新账号使用加盐哈希，路径不可被枚举推算。
 * - 老账号的历史数据仍以旧的无盐哈希存储；登录时检测到旧数据即自动沿用旧键，
 *   因此老用户不会因为换哈希而“看不到自己的棋谱”，也无需搬运 R2 文件。
 * - 一旦某账号已存在加盐数据，则始终优先使用加盐键。
 *
 * 该解析是确定性的（仅依赖账号自身的历史数据），因此并发首登也不会产生分歧。
 */
export async function resolveUserStorageKey(request: Request): Promise<string> {
  const identifier = await extractIdentifier(request);
  const salted = hashIdentifier(identifier);
  const legacy = legacyHashIdentifier(identifier);

  // 未配置盐时两者相同，直接用（保持旧的开发/兼容行为）
  if (salted === legacy) return salted;

  if ((await prisma.record.count({ where: { userHash: salted } })) > 0) {
    return salted;
  }
  if ((await prisma.record.count({ where: { userHash: legacy } })) > 0) {
    return legacy;
  }
  return salted;
}
