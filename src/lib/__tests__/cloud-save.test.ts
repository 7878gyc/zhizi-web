import { describe, it, expect, vi } from 'vitest';
import { uploadSgfToCloud } from '@/lib/cloud-save';

const blob = new Blob(['(;GM[1])'], { type: 'application/x-go-sgf' });

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('uploadSgfToCloud', () => {
  it('creates a record and returns its id/key so later saves can update it', async () => {
    const fetchImpl = vi.fn(async (url: string, _init?: RequestInit) => {
      void _init;
      if (url === '/api/upload') {
        return json({ uploadUrl: 'https://r2.example/put', fileKey: 'records/u/a.sgf' });
      }
      if (url === 'https://r2.example/put') return new Response('ok');
      if (url === '/api/records') {
        return json({ record: { id: 'r1', fileKey: 'records/u/a.sgf' } }, 201);
      }
      throw new Error(`unexpected ${url}`);
    });

    const result = await uploadSgfToCloud({
      fileName: 'test.sgf',
      blob,
      sourceRecordId: null,
      sourceFileKey: null,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({ recordId: 'r1', fileKey: 'records/u/a.sgf' });
    const post = fetchImpl.mock.calls.find(([url]) => url === '/api/records');
    expect(post).toBeDefined();
    expect(JSON.parse(String(post![1]?.body))).toMatchObject({
      fileName: 'test.sgf',
      fileKey: 'records/u/a.sgf',
      fileSize: blob.size,
    });
  });

  it('does not report success when the record API fails', async () => {
    const fetchImpl = vi.fn(async (url: string, _init?: RequestInit) => {
      void _init;
      if (url === '/api/upload') {
        return json({ uploadUrl: 'https://r2.example/put', fileKey: 'records/u/a.sgf' });
      }
      if (url === 'https://r2.example/put') return new Response('ok');
      return json({ error: '数据库写入失败' }, 500);
    });

    await expect(
      uploadSgfToCloud({
        fileName: 'test.sgf',
        blob,
        sourceRecordId: null,
        sourceFileKey: null,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow('数据库写入失败');
  });

  it('updates an existing record with PATCH instead of creating a duplicate', async () => {
    const fetchImpl = vi.fn(async (url: string, _init?: RequestInit) => {
      void _init;
      if (url === '/api/upload') {
        return json({ uploadUrl: 'https://r2.example/put', fileKey: 'records/u/a.sgf' });
      }
      if (url === 'https://r2.example/put') return new Response('ok');
      if (url === '/api/records/r1') return json({ record: { id: 'r1' } });
      throw new Error(`unexpected ${url}`);
    });

    const result = await uploadSgfToCloud({
      fileName: 'renamed.sgf',
      blob,
      sourceRecordId: 'r1',
      sourceFileKey: 'records/u/a.sgf',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({ recordId: 'r1', fileKey: 'records/u/a.sgf' });
    expect(fetchImpl.mock.calls.some(([url]) => url === '/api/records')).toBe(false);
    const patch = fetchImpl.mock.calls.find(([url]) => url === '/api/records/r1');
    expect(patch![1]?.method).toBe('PATCH');
    const upload = fetchImpl.mock.calls.find(([url]) => url === '/api/upload');
    expect(JSON.parse(String(upload![1]?.body))).toMatchObject({
      fileKey: 'records/u/a.sgf',
    });
  });

  it('rejects when the presigned upload fails', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => {
      void _url;
      void _init;
      return json({ error: '文件大小非法' }, 400);
    });
    await expect(
      uploadSgfToCloud({
        fileName: 'test.sgf',
        blob,
        sourceRecordId: null,
        sourceFileKey: null,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow('文件大小非法');
  });
});
