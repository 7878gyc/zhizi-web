import { describe, it, expect } from 'vitest';
import {
  MAX_SGF_FILE_SIZE,
  isValidSgfFileName,
  isValidSgfFileSize,
} from '@/lib/record-limits';

describe('record limits', () => {
  it('accepts normal SGF names', () => {
    expect(isValidSgfFileName('柯洁vs申真谞.sgf')).toBe(true);
  });

  it('rejects empty, oversized or control-character file names', () => {
    expect(isValidSgfFileName('')).toBe(false);
    expect(isValidSgfFileName('   ')).toBe(false);
    expect(isValidSgfFileName('a'.repeat(256))).toBe(false);
    expect(isValidSgfFileName('bad\u0000name')).toBe(false);
    expect(isValidSgfFileName(123)).toBe(false);
  });

  it('validates file size bounds', () => {
    expect(isValidSgfFileSize(1)).toBe(true);
    expect(isValidSgfFileSize(MAX_SGF_FILE_SIZE)).toBe(true);
    expect(isValidSgfFileSize(0)).toBe(false);
    expect(isValidSgfFileSize(-1)).toBe(false);
    expect(isValidSgfFileSize(MAX_SGF_FILE_SIZE + 1)).toBe(false);
    expect(isValidSgfFileSize(1.5)).toBe(false);
    expect(isValidSgfFileSize('1024')).toBe(false);
  });
});
