import { describe, it, expect, beforeEach } from 'vitest';
import { saveToken, getToken, removeToken, saveUser, getUser, isLoggedIn, TOKEN_KEY } from '@/lib/auth';

describe('auth token management', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saves and retrieves the token', () => {
    saveToken('abc123');
    expect(getToken()).toBe('abc123');
    expect(localStorage.getItem(TOKEN_KEY)).toBe('abc123');
  });

  it('returns null when no token is stored', () => {
    expect(getToken()).toBeNull();
  });

  it('isLoggedIn reflects token presence', () => {
    expect(isLoggedIn()).toBe(false);
    saveToken('x');
    expect(isLoggedIn()).toBe(true);
  });

  it('removeToken clears token and user', () => {
    saveToken('x');
    saveUser({ name: 'test' });
    removeToken();
    expect(getToken()).toBeNull();
    expect(getUser()).toBeNull();
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
});
