import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ReviewOutcomeDetails } from '@/components/quiz/review-outcome-section';
import type { ReviewOutcomeQuestion } from '@/lib/quiz/srs/outcome';

function question(
  name: string,
  category: ReviewOutcomeQuestion['category'],
  rows: ReviewOutcomeQuestion['rows'],
): ReviewOutcomeQuestion {
  return { name, mode: 'B', isCorrect: true, category, rows };
}

describe('ReviewOutcomeDetails', () => {
  it('残り回数の少ない見出し順に出し、行の右にあとN回を置く', () => {
    const html = renderToStaticMarkup(
      createElement(ReviewOutcomeDetails, {
        defaultOpen: true,
        questions: [
          question('後', 'continuing', [
            { code: '2', prefecture: '千葉県', label: { kind: 'scheduled', daysUntil: 6 }, graduated: false, remainingSteps: 3 },
          ]),
          question('先', 'continuing', [
            { code: '1', prefecture: '青森県', label: { kind: 'scheduled', daysUntil: 1 }, graduated: false, remainingSteps: 1 },
          ]),
          question('伊達市', 'continuing', [
            { code: 'h', prefecture: '北海道', label: { kind: 'scheduled', daysUntil: 13 }, graduated: false, remainingSteps: 5 },
            { code: 'f', prefecture: '福島県', label: { kind: 'scheduled', daysUntil: 6 }, graduated: false, remainingSteps: 2 },
          ]),
          question('定着', 'graduated', [
            { code: 'g', prefecture: '北海道', label: { kind: 'graduated' }, graduated: true },
          ]),
          question('失敗', 'saveFailed', [
            { code: 's', prefecture: '青森県', label: { kind: 'saveFailed' }, graduated: false },
          ]),
        ],
      }),
    );

    const at = (text: string) => html.indexOf(text);
    expect(at('あと1回 1問')).toBeLessThan(at('あと2回 1問'));
    expect(at('あと2回 1問')).toBeLessThan(at('あと3回 1問'));
    expect(at('あと3回 1問')).toBeLessThan(at('卒業 1問'));
    expect(at('卒業 1問')).toBeLessThan(at('保存失敗 1問'));
    expect(at('伊達市')).toBeGreaterThan(at('あと2回 1問'));
    expect(at('伊達市')).toBeLessThan(at('あと3回 1問'));
    expect(html.match(/あと5回/g)).toEqual(['あと5回']);
    expect(html.match(/あと2回/g)).toHaveLength(2);
    expect(html).toContain('justify-between');
    expect(html).not.toContain('あと4回');
  });
});
