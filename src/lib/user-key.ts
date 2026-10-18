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

/** 把某个旧键下的记录逐条迁移到加盐键（拷贝 → 更新 DB → 删除旧对象）。 */
async function migrateLegacyRecords(legacy: string, salted: string): Promise<MigrateResult> {
  const records = await prisma.record.findMany({
    where: { userHash: legacy },
    select: { id: true, fileKey: true },
  });

  const legacyPrefix = `records/${legacy}/`;
  const saltedPrefix = `records/${salted}/`;
  let migrated = 0;

  for (const record of records) {
    // 只迁移 fileKey 确实位于旧目录下的记录；异常/历史越权引用一律跳过
    if (!ownsFileKey(legacy, record.fileKey)) {
      console.warn('[user-key] skip record with non-conforming fileKey:', record.id);
      continue;
    }

    const newKey = `${saltedPrefix}${record.fileKey.slice(legacyPrefix.length)}`;
    try {
      // 1) 拷贝到新前缀（保留原 metadata / content-type）
      await s3Client.send(
        new CopyObjectCommand({
          Bucket: r2Bucket,
          CopySource: `${r2Bucket}/${record.fileKey}`,
          Key: newKey,
          MetadataDirective: 'COPY',
        }),
      );
      // 2) 更新数据库归属与路径
      await prisma.record.update({
        where: { id: record.id },
        data: { userHash: salted, fileKey: newKey },
      });
      migrated += 1;
      // 3) 删除旧对象（尽力而为；失败也不影响正确性）
      try {
        await s3Client.send(
          new DeleteObjectCommand({ Bucket: r2Bucket, Key: record.fileKey }),
        );
      } catch (e) {
        console.error('[user-key] delete old object failed (non-fatal):', record.id, e);
      }
    } catch (e) {
      // 拷贝或 DB 更新失败：保留旧数据，整体回退到旧键，下次登录重试
      console.error('[user-key] migrate record failed:', record.id, e);
      return { migrated, ok: false };
    }
  }

  return { migrated, ok: true };
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
