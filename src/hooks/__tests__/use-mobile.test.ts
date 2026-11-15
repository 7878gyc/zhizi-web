import { describe, it, expect } from 'vitest';
import { isMobileViewport } from '@/hooks/use-mobile';

describe('isMobileViewport', () => {
  it('uses mobile layout below 768px', () => {
    expect(isMobileViewport(375, 812)).toBe(true);
    expect(isMobileViewport(767, 900)).toBe(true);
    expect(isMobileViewport(768, 900)).toBe(false);
  });

  it('uses mobile layout for short landscape phones', () => {
    expect(isMobileViewport(844, 390)).toBe(true);
    expect(isMobileViewport(667, 375)).toBe(true);
    expect(isMobileViewport(1023, 500)).toBe(true);
  });

  it('keeps desktop layout for normal desktop/tablet sizes', () => {
    expect(isMobileViewport(1024, 768)).toBe(false);
    expect(isMobileViewport(1440, 900)).toBe(false);
    expect(isMobileViewport(900, 700)).toBe(false);
  });
});
