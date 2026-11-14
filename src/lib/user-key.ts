import { CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { prisma } from '@/lib/prisma';
import { s3Client, r2Bucket } from '@/lib/r2-client';
import {
  extractIdentifier,
  hashIdentifier,
  legacyHashIdentifier,
  ownsFileKey,
} from '@/lib/auth-server';

/**
 * 用户存储键（DB 的 userHash + R2 路径前缀）解析与老数据迁移。
 *
 * 新账号：使用加盐哈希（HMAC-SHA256），路径不可由手机号/邮箱推算。
 * 老账号：检测到旧的无盐哈希数据后，自动把 R2 对象拷到加盐前缀、更新 DB、
 * 再删除旧对象，实现「登录即迁移」；迁移失败时临时沿用旧键，避免丢数据。
 */

interface MigrateResult {
  migrated: number;
  ok: boolean;
}

/**
 * 把某个旧键下的记录迁移到加盐键。
 *
 * 两阶段：先把所有对象拷贝到新前缀，再用一个事务批量更新 DB，最后删除旧对象。
 * 这样不会出现「部分记录已改到新键、部分仍在旧键」的中间态导致用户暂时看不到数据。
 */
async function migrateLegacyRecords(legacy: string, salted: string): Promise<MigrateResult> {
  const records = await prisma.record.findMany({
    where: { userHash: legacy },
    select: { id: true, fileKey: true },
  });

  const legacyPrefix = `records/${legacy}/`;
  const saltedPrefix = `records/${salted}/`;
  const copied: { id: string; oldKey: string; newKey: string }[] = [];

  const cleanupCopies = async () => {
    for (const item of copied) {
      try {
        await s3Client.send(
          new DeleteObjectCommand({ Bucket: r2Bucket, Key: item.newKey }),
        );
      } catch (e) {
        console.error('[user-key] cleanup copied object failed (non-fatal):', item.id, e);
      }
    }
  };

  // 阶段 1：拷贝。任一失败就回滚已拷贝对象，全部保留旧键。
  for (const record of records) {
    // 只迁移 fileKey 确实位于旧目录下的记录；异常/历史越权引用一律跳过
    if (!ownsFileKey(legacy, record.fileKey)) {
      console.warn('[user-key] skip record with non-conforming fileKey:', record.id);
      continue;
    }

    const newKey = `${saltedPrefix}${record.fileKey.slice(legacyPrefix.length)}`;
    try {
      await s3Client.send(
        new CopyObjectCommand({
          Bucket: r2Bucket,
          CopySource: `${r2Bucket}/${record.fileKey}`,
          Key: newKey,
          MetadataDirective: 'COPY',
        }),
      );
      copied.push({ id: record.id, oldKey: record.fileKey, newKey });
    } catch (e) {
      console.error('[user-key] migrate record failed:', record.id, e);
      await cleanupCopies();
      return { migrated: 0, ok: false };
    }
  }

  if (copied.length === 0) return { migrated: 0, ok: true };

  // 阶段 2：DB 事务。失败则回滚拷贝，仍使用旧键。
  try {
    await prisma.$transaction(
      copied.map((item) =>
        prisma.record.update({
          where: { id: item.id },
          data: { userHash: salted, fileKey: item.newKey },
        }),
      ),
    );
  } catch (e) {
    console.error('[user-key] migrate transaction failed:', e);
    await cleanupCopies();
    return { migrated: 0, ok: false };
  }

  // 阶段 3：删除旧对象（尽力而为；失败也不影响正确性）
  for (const item of copied) {
    try {
      await s3Client.send(
        new DeleteObjectCommand({ Bucket: r2Bucket, Key: item.oldKey }),
      );
    } catch (e) {
      console.error('[user-key] delete old object failed (non-fatal):', item.id, e);
    }
  }

  return { migrated: copied.length, ok: true };
}

async function resolve(identifier: string): Promise<{ key: string; migrated: number }> {
  const salted = hashIdentifier(identifier);
  const legacy = legacyHashIdentifier(identifier);

  // 未配置盐：新旧键相同，直接使用（保持兼容）
  if (salted === legacy) return { key: salted, migrated: 0 };

  const legacyCount = await prisma.record.count({ where: { userHash: legacy } });
  // 没有旧数据：新账号或已迁移完成，直接使用加盐键
  if (legacyCount === 0) return { key: salted, migrated: 0 };

  const { migrated, ok } = await migrateLegacyRecords(legacy, salted);
  // 迁移失败则临时沿用旧键，保证用户仍能看到未迁移的数据
  return { key: ok ? salted : legacy, migrated };
}

/** 供 records / upload 等接口使用：解析当前用户的存储键（顺带完成老数据迁移）。 */
export async function resolveUserStorageKey(request: Request): Promise<string> {
  const identifier = await extractIdentifier(request);
  return (await resolve(identifier)).key;
}

/** 供登录后主动触发的迁移接口使用，返回本次迁移的记录数。 */
export async function migrateCurrentUser(
  request: Request,
): Promise<{ storageKey: string; migrated: number }> {
  const identifier = await extractIdentifier(request);
  const { key, migrated } = await resolve(identifier);
  return { storageKey: key, migrated };
}
