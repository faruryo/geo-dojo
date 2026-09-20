// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ConfettiOverlay } from '@/components/quiz/effects/confetti-overlay';

(globalThis as unknown as Record<string, boolean>).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

let mockReducedMotion = false;
vi.mock('@/lib/hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => mockReducedMotion,
}));

beforeEach(() => {
  vi.useFakeTimers();
  mockReducedMotion = false;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

describe('ConfettiOverlay (FR-006b, FR-006d)', () => {
  it('streak === 5 のときのみレンダリングされる', () => {
    // streak 4
    act(() => {
      root.render(<ConfettiOverlay streak={4} />);
    });
    expect(host.querySelector('[data-testid="confetti-overlay"]')).toBeNull();

    // streak 6
    act(() => {
      root.render(<ConfettiOverlay streak={6} />);
    });
    expect(host.querySelector('[data-testid="confetti-overlay"]')).toBeNull();

    // streak 5
    act(() => {
      root.render(<ConfettiOverlay streak={5} />);
    });
    expect(host.querySelector('[data-testid="confetti-overlay"]')).not.toBeNull();
  });

  it('prefers-reduced-motion が有効な場合は非表示 (FR-006d)', () => {
    mockReducedMotion = true;
    act(() => {
      root.render(<ConfettiOverlay streak={5} />);
    });
    expect(host.querySelector('[data-testid="confetti-overlay"]')).toBeNull();
  });

  it('1.5秒経過後に自然にアンマウントされる', () => {
    act(() => {
      root.render(<ConfettiOverlay streak={5} />);
    });
    expect(host.querySelector('[data-testid="confetti-overlay"]')).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(host.querySelector('[data-testid="confetti-overlay"]')).toBeNull();
  });
});
