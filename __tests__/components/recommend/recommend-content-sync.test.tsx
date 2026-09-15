// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

(globalThis as unknown as Record<string, boolean>).IS_REACT_ACT_ENVIRONMENT = true;

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

type SheetRecommendation = {
  mode: 'A' | 'B' | 'C' | 'D';
  count: 10 | 20 | 30;
  regions: string[];
  difficulties: Array<'easy' | 'medium' | 'hard' | 'expert'>;
  codes: string[];
  rationaleCategory: string;
  rationaleText: string;
  notes: string[];
};

const { recommendation } = vi.hoisted(() => {
  const current: SheetRecommendation = {
    mode: 'A',
    count: 10,
    regions: ['中国'],
    difficulties: ['easy'],
    codes: ['33101'],
    rationaleCategory: 'new-exploration',
    rationaleText: '中国の☆ 入門（モードA）',
    notes: [],
  };
  return { recommendation: { current } };
});

vi.mock('@/lib/hooks/useRecommendation', () => ({
  useRecommendation: () => ({
    data: recommendation.current,
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

const { RecommendContent } = await import('@/components/recommend/recommend-content');
const { RecommendOverride } = await import('@/components/recommend/recommend-override');

let container: HTMLDivElement;
let root: Root;

function render(node: React.ReactElement) {
  act(() => {
    root.render(node);
  });
}

function text(): string {
  return container.textContent ?? '';
}

function buttonByText(label: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll('button')].find((b) =>
    b.textContent?.includes(label),
  );
}

function startedUrl(): string {
  expect(mockPush).toHaveBeenCalled();
  return decodeURIComponent(mockPush.mock.calls[0][0] as string);
}

async function startQuiz() {
  const startBtn = buttonByText('そのまま開始');
  expect(startBtn).toBeDefined();
  await act(async () => {
    startBtn?.click();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  recommendation.current = {
    mode: 'A',
    count: 10,
    regions: ['中国'],
    difficulties: ['easy'],
    codes: ['33101'],
    rationaleCategory: 'new-exploration',
    rationaleText: '中国の☆ 入門（モードA）',
    notes: [],
  };
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

describe('おすすめシートの理由文と出題内容の同期 (#107)', () => {
  it('localStorage に過去の地方が残っていても、未操作の初期表示と開始先は推薦地方のまま', async () => {
    localStorage.setItem(
      'geodojo-recommend-region-filters',
      JSON.stringify({ targetRegions: ['東北'] }),
    );

    render(<RecommendContent onClose={vi.fn()} />);

    expect(text()).toContain('モードA・逆引き地図');
    expect(text()).toContain('地方: 中国');
    expect(text()).toContain('中国の☆ 入門（モードA）');
    expect(text()).not.toContain('モードB・逆引き4択');
    expect(text()).not.toContain('地方: 東北');

    await startQuiz();

    expect(mockPush).toHaveBeenCalledTimes(1);
    const navUrl = startedUrl();
    expect(navUrl).toContain('/quiz/municipality/a');
    expect(navUrl).toContain('region=中国');
    expect(navUrl).not.toContain('東北');
  });

  it('推薦データが更新されたらサマリー・理由文・開始先が同じ推薦に揃う', async () => {
    recommendation.current = {
      mode: 'B',
      count: 10,
      regions: ['関東'],
      difficulties: ['easy'],
      codes: ['13101'],
      rationaleCategory: 'weakness-focused',
      rationaleText: '関東の☆ 入門（モードB）',
      notes: [],
    };

    render(<RecommendContent onClose={vi.fn()} />);
    expect(text()).toContain('モードB・逆引き4択');

    recommendation.current = {
      mode: 'A',
      count: 10,
      regions: ['中国'],
      difficulties: ['easy'],
      codes: ['33101'],
      rationaleCategory: 'new-exploration',
      rationaleText: '中国の☆ 入門（モードA）',
      notes: [],
    };
    render(<RecommendContent onClose={vi.fn()} />);

    expect(text()).toContain('モードA・逆引き地図');
    expect(text()).toContain('地方: 中国');
    expect(text()).toContain('中国の☆ 入門（モードA）');
    expect(text()).not.toContain('モードB・逆引き4択');
    expect(text()).not.toContain('地方: 関東');

    await startQuiz();

    const navUrl = startedUrl();
    expect(navUrl).toContain('/quiz/municipality/a');
    expect(navUrl).toContain('region=中国');
  });

  it('ユーザーが内容を変えたときだけ開始パラメータを上書きする', async () => {
    render(<RecommendContent onClose={vi.fn()} />);

    await act(async () => {
      buttonByText('内容を変える')?.click();
    });
    await act(async () => {
      buttonByText('モードB')?.click();
    });
    await act(async () => {
      buttonByText('全国')?.click();
    });
    await act(async () => {
      buttonByText('東北')?.click();
    });

    expect(text()).toContain('モードB・逆引き4択');
    expect(text()).toContain('地方: 東北');
    expect(text()).toContain('中国の☆ 入門（モードA）');

    await startQuiz();

    const navUrl = startedUrl();
    expect(navUrl).toContain('/quiz/municipality/b');
    expect(navUrl).toContain('region=東北');
  });

  it('明示操作のあと推薦が変わって元に戻っても、古い上書きは復活しない', async () => {
    render(<RecommendContent onClose={vi.fn()} />);

    await act(async () => {
      buttonByText('内容を変える')?.click();
    });
    await act(async () => {
      buttonByText('モードB')?.click();
    });
    await act(async () => {
      buttonByText('全国')?.click();
    });
    await act(async () => {
      buttonByText('東北')?.click();
    });

    recommendation.current = {
      mode: 'B',
      count: 10,
      regions: ['関東'],
      difficulties: ['easy'],
      codes: ['13101'],
      rationaleCategory: 'weakness-focused',
      rationaleText: '関東の☆ 入門（モードB）',
      notes: [],
    };
    render(<RecommendContent onClose={vi.fn()} />);
    expect(text()).toContain('地方: 関東');
    expect(text()).not.toContain('地方: 東北');

    recommendation.current = {
      mode: 'A',
      count: 10,
      regions: ['中国'],
      difficulties: ['easy'],
      codes: ['33101'],
      rationaleCategory: 'new-exploration',
      rationaleText: '中国の☆ 入門（モードA）',
      notes: [],
    };
    render(<RecommendContent onClose={vi.fn()} />);

    expect(text()).toContain('モードA・逆引き地図');
    expect(text()).toContain('地方: 中国');
    expect(text()).not.toContain('モードB・逆引き4択');
    expect(text()).not.toContain('地方: 東北');

    await startQuiz();

    const navUrl = startedUrl();
    expect(navUrl).toContain('/quiz/municipality/a');
    expect(navUrl).toContain('region=中国');
    expect(navUrl).not.toContain('東北');
  });

  it('RecommendOverride はマウントだけでは localStorage の地方を親へ流さない', async () => {
    localStorage.setItem(
      'geodojo-recommend-region-filters',
      JSON.stringify({ targetRegions: ['東北'] }),
    );
    const onChange = vi.fn();

    render(
      <RecommendOverride
        initial={{
          mode: 'A',
          count: 10,
          regions: ['中国'],
          difficulties: ['easy'],
        }}
        onChange={onChange}
      />,
    );

    expect(onChange).not.toHaveBeenCalled();
  });
});
