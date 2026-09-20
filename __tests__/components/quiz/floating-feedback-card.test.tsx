// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  FloatingFeedbackCard,
  type FloatingFeedbackCardProps,
} from '@/components/quiz/hud/floating-feedback-card';
import type { FeedbackItem } from '@/lib/quiz/municipality-population';

(globalThis as unknown as Record<string, boolean>).IS_REACT_ACT_ENVIRONMENT = true;

describe('FloatingFeedbackCard (FR-003, FR-006a, FR-006e)', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    host.remove();
  });

  function render(props: FloatingFeedbackCardProps) {
    act(() => {
      root.render(<FloatingFeedbackCard {...props} />);
    });
  }

  const singleItem: FeedbackItem = {
    prefecture: '千葉県',
    name: '館山市',
    kana: 'たてやまし',
    population: 44_120,
    formattedPopulation: '約4.4万人',
  };

  it('renders correctly for a single correct answer with streak = 1', () => {
    render({
      isCorrect: true,
      streak: 1,
      difficulty: 'medium',
      items: [singleItem],
    });

    expect(host.textContent).toContain('🎉 正解！');
    expect(host.textContent).toContain('正解！'); // praise label
    expect(host.textContent).not.toContain('連続'); // no streak badge for streak 1
    expect(host.textContent).toContain('館山市');
    expect(host.textContent).toContain('たてやまし');
    expect(host.textContent).toContain('☆☆ 中級');
    expect(host.textContent).toContain('約4.4万人');
  });

  it('renders streak badge and elevated praise label for streak >= 2', () => {
    render({
      isCorrect: true,
      streak: 3,
      difficulty: 'hard',
      items: [singleItem],
    });

    expect(host.textContent).toContain('🎉 正解！');
    expect(host.textContent).toContain('お見事！');
    expect(host.textContent).toContain('3連続');
    expect(host.textContent).toContain('☆☆☆ 上級');
  });

  it('renders for incorrect answer without praise label or streak badge', () => {
    render({
      isCorrect: false,
      streak: 0,
      difficulty: 'easy',
      items: [singleItem],
    });

    expect(host.textContent).toContain('✗ 不正解');
    expect(host.textContent).not.toContain('連続');
    expect(host.textContent).not.toContain('お見事');
    expect(host.textContent).toContain('館山市');
    expect(host.textContent).toContain('約4.4万人');
  });

  it('renders all prefectures for Mode A multiple instances (e.g. 4 prefectures)', () => {
    const multiItems: FeedbackItem[] = [
      { prefecture: '北海道', name: '池田町', kana: 'いけだちょう', population: 6320, formattedPopulation: '約6,320人' },
      { prefecture: '福井県', name: '池田町', kana: 'いけだちょう', population: 2400, formattedPopulation: '約2,400人' },
      { prefecture: '長野県', name: '池田町', kana: 'いけだまち', population: 13500, formattedPopulation: '約1.4万人' },
      { prefecture: '岐阜県', name: '池田町', kana: 'いけだちょう', population: 23100, formattedPopulation: '約2.3万人' },
    ];

    render({
      isCorrect: true,
      streak: 2,
      difficulty: 'expert',
      items: multiItems,
    });

    expect(host.textContent).toContain('2連続');
    expect(host.textContent).toContain('☆☆☆☆ 達人');
    expect(host.textContent).toContain('北海道');
    expect(host.textContent).toContain('福井県');
    expect(host.textContent).toContain('長野県');
    expect(host.textContent).toContain('岐阜県');
    expect(host.textContent).toContain('約6,320人');
    expect(host.textContent).toContain('約1.4万人');
  });

  it('omits population display when population is missing/null', () => {
    const itemWithoutPop: FeedbackItem = {
      prefecture: '大阪府',
      name: '大阪市',
      kana: 'おおさかし',
      population: null,
      formattedPopulation: null,
    };

    render({
      isCorrect: true,
      streak: 1,
      difficulty: 'hard',
      items: [itemWithoutPop],
    });

    expect(host.textContent).toContain('大阪市');
    expect(host.textContent).not.toContain('約');
  });

  it('calls onSkip when card is clicked (FR-004a)', () => {
    const onSkip = vi.fn();
    render({
      isCorrect: true,
      streak: 1,
      difficulty: 'medium',
      items: [singleItem],
      onSkip,
    });

    const card = host.firstElementChild as HTMLElement;
    expect(card).not.toBeNull();
    card.click();
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('isolates aria-live="polite" to sr-only element and hides visible content from assistive tech (FR-006e)', () => {
    render({
      isCorrect: true,
      streak: 4,
      difficulty: 'medium',
      items: [singleItem],
    });

    const srOnly = host.querySelector('.sr-only');
    expect(srOnly).not.toBeNull();
    expect(srOnly?.getAttribute('role')).toBe('status');
    expect(srOnly?.getAttribute('aria-live')).toBe('polite');

    const visibleContent = host.querySelector('[aria-hidden="true"]');
    expect(visibleContent).not.toBeNull();

    const text = srOnly?.textContent ?? '';
    expect(text).toContain('正解！');
    expect(text).toContain('館山市');
    expect(text).toContain('約4.4万人');
    expect(text).not.toContain('4連続');
  });
});
