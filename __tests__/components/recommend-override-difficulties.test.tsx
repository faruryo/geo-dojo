// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { RecommendOverride, type Overrides } from '@/components/recommend/recommend-override';
import { RecommendContent } from '@/components/recommend/recommend-content';

(globalThis as unknown as Record<string, boolean>).IS_REACT_ACT_ENVIRONMENT = true;

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

const mockRecommendationData = {
  mode: 'B' as const,
  count: 10 as const,
  regions: ['関東'] as const,
  difficulties: ['easy'] as const,
  codes: ['13101', '13102'],
  rationaleCategory: 'weakness-focused' as const,
  rationaleText: '苦手な問題を中心に出題します',
  notes: [],
};

vi.mock('@/lib/hooks/useRecommendation', () => ({
  useRecommendation: () => ({
    data: mockRecommendationData,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/lib/auth/browser-user', () => ({
  getBrowserUserId: () => Promise.resolve('test-user-id'),
}));

vi.mock('@/lib/quiz/recommendation/history-cache', () => ({
  writeRecommendationHistory: vi.fn(),
}));

describe('RecommendOverride and RecommendContent Difficulty Override', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  it('renders initial difficulty in RecommendOverride and emits via onChange', async () => {
    let lastOverrides: Overrides | null = null;
    const onChange = vi.fn((o: Overrides) => {
      lastOverrides = o;
    });

    await act(async () => {
      root?.render(
        <RecommendOverride
          initial={{
            mode: 'B',
            count: 10,
            regions: ['関東'],
            difficulties: ['easy'],
          }}
          onChange={onChange}
        />
      );
    });

    expect(onChange).toHaveBeenCalled();
    expect((lastOverrides as Overrides | null)?.difficulties).toEqual(['easy']);

    // Expand settings
    const toggleButton = container?.querySelector('button');
    expect(toggleButton).not.toBeNull();
    await act(async () => {
      toggleButton?.click();
    });

    // Find difficulty buttons
    const buttons = Array.from(container?.querySelectorAll('button') ?? []);
    const mediumBtn = buttons.find((b) => b.textContent?.includes('☆☆ 中級'));
    expect(mediumBtn).not.toBeNull();

    // Toggle medium ON
    await act(async () => {
      mediumBtn?.click();
    });

    expect((lastOverrides as Overrides | null)?.difficulties).toEqual(['easy', 'medium']);

    // Toggle easy OFF
    const easyBtn = buttons.find((b) => b.textContent?.includes('☆ 入門'));
    await act(async () => {
      easyBtn?.click();
    });

    expect((lastOverrides as Overrides | null)?.difficulties).toEqual(['medium']);
  });

  it('disables start button with guidance when all difficulties are deselected in RecommendContent', async () => {
    await act(async () => {
      root?.render(<RecommendContent onClose={vi.fn()} />);
    });

    // Expand override form
    const toggleButton = Array.from(container?.querySelectorAll('button') ?? []).find((b) =>
      b.textContent?.includes('内容を変える')
    );
    expect(toggleButton).not.toBeNull();
    await act(async () => {
      toggleButton?.click();
    });

    // Initially, start button is active
    let startBtn = Array.from(container?.querySelectorAll('button') ?? []).find(
      (b) => b.textContent?.includes('そのまま開始')
    );
    expect(startBtn).not.toBeUndefined();
    expect(startBtn?.getAttribute('disabled')).toBeNull();

    // Toggle easy difficulty off (it was the only selected difficulty in mock data)
    const easyBtn = Array.from(container?.querySelectorAll('button') ?? []).find((b) =>
      b.textContent?.includes('☆ 入門')
    );
    expect(easyBtn).not.toBeUndefined();
    await act(async () => {
      easyBtn?.click();
    });

    // Now start button should be disabled with message
    startBtn = Array.from(container?.querySelectorAll('button') ?? []).find((b) =>
      b.textContent?.includes('難易度を1つ以上選んでください')
    );
    expect(startBtn).not.toBeUndefined();
    expect(startBtn?.getAttribute('disabled')).not.toBeNull();

    // Toggle hard difficulty on
    const hardBtn = Array.from(container?.querySelectorAll('button') ?? []).find((b) =>
      b.textContent?.includes('☆☆☆ 上級')
    );
    expect(hardBtn).not.toBeUndefined();
    await act(async () => {
      hardBtn?.click();
    });

    // Now start button should be enabled again
    startBtn = Array.from(container?.querySelectorAll('button') ?? []).find(
      (b) => b.textContent?.includes('そのまま開始')
    );
    expect(startBtn).not.toBeUndefined();
    expect(startBtn?.getAttribute('disabled')).toBeNull();

    // Click start and verify navigation URL includes overridden difficulties
    await act(async () => {
      startBtn?.click();
    });

    expect(mockPush).toHaveBeenCalledTimes(1);
    const navUrl = mockPush.mock.calls[0][0] as string;
    expect(navUrl).toContain('difficulties=hard');
    expect(navUrl).toContain('/quiz/municipality/b');
  });
});
