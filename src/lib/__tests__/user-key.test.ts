import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: { record: { count: vi.fn(), findMany: vi.fn(), update: vi.fn() } },
}));

vi.mock('@/lib/r2-client', () => ({
  s3Client: { send: vi.fn() },
  r2Bucket: 'test-bucket',
}));

vi.mock('@/lib/auth-server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth-server')>();
  return { ...actual, extractIdentifier: vi.fn() };
});

import { prisma } from '@/lib/prisma';
import { s3Client } from '@/lib/r2-client';
import { extractIdentifier, hashIdentifier, legacyHashIdentifier } from '@/lib/auth-server';
import { resolveUserStorageKey, migrateCurrentUser } from '@/lib/user-key';

const countMock = prisma.record.count as unknown as ReturnType<typeof vi.fn>;
const findManyMock = prisma.record.findMany as unknown as ReturnType<typeof vi.fn>;
const updateMock = prisma.record.update as unknown as ReturnType<typeof vi.fn>;
const sendMock = s3Client.send as unknown as ReturnType<typeof vi.fn>;
const extractMock = extractIdentifier as unknown as ReturnType<typeof vi.fn>;
const request = new Request('http://localhost/api/records');

const IDENTIFIER = '13800000000';

describe('resolveUserStorageKey / 老数据迁移', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('USER_HASH_SALT', 'unit-test-salt');
    extractMock.mockResolvedValue(IDENTIFIER);
    updateMock.mockResolvedValue({});
    sendMock.mockResolvedValue({});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('assigns the salted key to a brand new account without touching R2', async () => {
    countMock.mockResolvedValue(0);
    const key = await resolveUserStorageKey(request);
    expect(key).toBe(hashIdentifier(IDENTIFIER));
    expect(key).not.toBe(legacyHashIdentifier(IDENTIFIER));
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it('migrates legacy records to the salted prefix and returns the salted key', async () => {
    const legacy = legacyHashIdentifier(IDENTIFIER);
    const salted = hashIdentifier(IDENTIFIER);
    countMock.mockResolvedValue(1);
    findManyMock.mockResolvedValue([
      { id: 'r1', fileKey: `records/${legacy}/abc.sgf` },
    ]);

    const key = await resolveUserStorageKey(request);

    expect(key).toBe(salted);
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { userHash: salted, fileKey: `records/${salted}/abc.sgf` },
    });
    // 拷贝 + 删除旧对象
    expect(sendMock).toHaveBeenCalledTimes(2);
  });

  it('reports migrated count via migrateCurrentUser', async () => {
    const legacy = legacyHashIdentifier(IDENTIFIER);
    countMock.mockResolvedValue(1);
    findManyMock.mockResolvedValue([
      { id: 'r1', fileKey: `records/${legacy}/a.sgf` },
      { id: 'r2', fileKey: `records/${legacy}/b.sgf` },
    ]);

    const result = await migrateCurrentUser(request);
    expect(result.migrated).toBe(2);
    expect(result.storageKey).toBe(hashIdentifier(IDENTIFIER));
  });

  it('falls back to the legacy key when a copy/update fails', async () => {
    const legacy = legacyHashIdentifier(IDENTIFIER);
    countMock.mockResolvedValue(1);
    findManyMock.mockResolvedValue([{ id: 'r1', fileKey: `records/${legacy}/a.sgf` }]);
    sendMock.mockRejectedValueOnce(new Error('r2 copy failed'));

    const key = await resolveUserStorageKey(request);
    expect(key).toBe(legacy);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('skips records whose fileKey is not under the legacy prefix', async () => {
    const legacy = legacyHashIdentifier(IDENTIFIER);
    const salted = hashIdentifier(IDENTIFIER);
    countMock.mockResolvedValue(1);
    findManyMock.mockResolvedValue([{ id: 'bad', fileKey: 'records/someone-else/x.sgf' }]);

    const key = await resolveUserStorageKey(request);
    expect(key).toBe(salted);
    expect(updateMock).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('uses the legacy hash directly when no salt is configured', async () => {
    vi.stubEnv('USER_HASH_SALT', '');
    const key = await resolveUserStorageKey(request);
    expect(key).toBe(legacyHashIdentifier(IDENTIFIER));
    expect(countMock).not.toHaveBeenCalled();
  });
});
