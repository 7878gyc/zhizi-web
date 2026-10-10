import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { saveUser, getUser, clearUser, fetchCurrentUser } from '@/lib/auth';

describe('auth user cache', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('saveUser stores JSON and getUser parses it', () => {
    saveUser({ name: 'Alice', phone: '13800000000' });
    expect(getUser()).toEqual({ name: 'Alice', phone: '13800000000' });
  });

  it('getUser returns null for missing or invalid JSON', () => {
    expect(getUser()).toBeNull();
    localStorage.setItem('zhizi_user', '{not json');
    expect(getUser()).toBeNull();
  });

  it('clearUser removes the cached user', () => {
    saveUser({ name: 'Bob' });
    clearUser();
    expect(getUser()).toBeNull();
  });
});

describe('fetchCurrentUser', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the user payload when the session is valid', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ phone: '13800000000' }), { status: 200 }),
    );
    await expect(fetchCurrentUser()).resolves.toEqual({ phone: '13800000000' });
  });

  it('returns null when the session is invalid (401)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Not Authorized', { status: 401 }));
    await expect(fetchCurrentUser()).resolves.toBeNull();
  });

  it('returns null when the network fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));
    await expect(fetchCurrentUser()).resolves.toBeNull();
  });
});
