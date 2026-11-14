import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutoAnalyze } from '@/app/analyze/_hooks/use-auto-analyze';

describe('useAutoAnalyze', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not advance until the current position has analysis', () => {
    const goNext = vi.fn();
    let ready = false;
    renderHook(() =>
      useAutoAnalyze(true, true, goNext, () => ready),
    );

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(goNext).not.toHaveBeenCalled();

    ready = true;
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(goNext).toHaveBeenCalledTimes(1);
  });

  it('stops the interval when auto analysis is turned off', () => {
    const goNext = vi.fn();
    const { rerender } = renderHook(
      ({ active }: { active: boolean }) =>
        useAutoAnalyze(active, true, goNext, () => true),
      { initialProps: { active: true } },
    );

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(goNext).toHaveBeenCalledTimes(1);

    rerender({ active: false });
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(goNext).toHaveBeenCalledTimes(1);
  });
});
