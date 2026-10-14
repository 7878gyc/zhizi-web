import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: { record: { count: vi.fn() } },
}));

vi.mock('@/lib/auth-server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth-server')>();
  return { ...actual, extractIdentifier: vi.fn() };
});

import { prisma } from '@/lib/prisma';
import { extractIdentifier, legacyHashIdentifier } from '@/lib/auth-server';
import { resolveUserStorageKey } from '@/lib/user-key';

const countMock = prisma.record.count as unknown as ReturnType<typeof vi.fn>;
const extractMock = extractIdentifier as unknown as ReturnType<typeof vi.fn>;
const request = new Request('http://localhost/api/records');

describe('resolveUserStorageKey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('USER_HASH_SALT', 'unit-test-salt');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('adopts the legacy key for an existing (pre-salt) account', async () => {
    extractMock.mockResolvedValue('13800000000');
    countMock.mockResolvedValueOnce(0).mockResolvedValueOnce(1); // salted=0, legacy=1
    await expect(resolveUserStorageKey(request)).resolves.toBe(legacyHashIdentifier('13800000000'));
  });

  it('prefers the salted key once salted records exist', async () => {
    extractMock.mockResolvedValue('13800000000');
    countMock.mockResolvedValueOnce(1); // salted=1
    const key = await resolveUserStorageKey(request);
    expect(key).not.toBe(legacyHashIdentifier('13800000000'));
    expect(countMock).toHaveBeenCalledTimes(1);
  });

  it('assigns the salted key to a brand new account', async () => {
    extractMock.mockResolvedValue('13800000000');
    countMock.mockResolvedValueOnce(0).mockResolvedValueOnce(0); // salted=0, legacy=0
    const key = await resolveUserStorageKey(request);
    expect(key).not.toBe(legacyHashIdentifier('13800000000'));
  });

  it('uses the legacy hash directly when no salt is configured', async () => {
    vi.stubEnv('USER_HASH_SALT', '');
    extractMock.mockResolvedValue('13800000000');
    await expect(resolveUserStorageKey(request)).resolves.toBe(legacyHashIdentifier('13800000000'));
    expect(countMock).not.toHaveBeenCalled();
  });
});
