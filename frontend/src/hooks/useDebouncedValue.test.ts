import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDebouncedValue } from './useDebouncedValue';

describe('useDebouncedValue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebouncedValue('milk', 200));
    expect(result.current).toBe('milk');
  });

  it('updates only after the delay', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 200),
      { initialProps: { value: 'm' } }
    );

    rerender({ value: 'mi' });
    expect(result.current).toBe('m');

    act(() => {
      vi.advanceTimersByTime(199);
    });
    expect(result.current).toBe('m');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe('mi');
  });

  it('resets the timer when value changes again', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 200),
      { initialProps: { value: 'a' } }
    );

    rerender({ value: 'ab' });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender({ value: 'abc' });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe('a');

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe('abc');
  });
});
