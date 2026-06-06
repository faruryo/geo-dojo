import { describe, it, expect } from 'vitest';
import {
  dedupeInstancesByPrefecture,
  type GameMode,
  type Municipality,
} from '@/lib/quiz/municipality-data';
import { toQuestionResult, type AnswerEntry } from '@/lib/quiz/quiz-results';

function muni(code: string, name: string, prefecture: string): Municipality {
  return { code, name, prefecture, region: '' };
}

/** Mode A の1問に対する保存 entries（県ごとに代表1件）を組み立てる。 */
function modeAEntries(instances: Municipality[], isCorrect: boolean): AnswerEntry[] {
  return dedupeInstancesByPrefecture(instances).map((m) => ({
    municipality: m,
    isCorrect,
    mode: 'A' as GameMode,
  }));
}

describe('toQuestionResult (二重カウント回帰防止)', () => {
  it('B/C/D の単一回答は1件をそのまま返す', () => {
    const r = toQuestionResult([{ municipality: muni('13206', '府中市', '東京都'), isCorrect: true, mode: 'B' }]);
    expect(r).toEqual({ name: '府中市', prefecture: '東京都', correct: true });
  });

  it('Mode A・複数県の同名市（伊達市=北海道/福島）でも表示結果は1件', () => {
    const date = [muni('01233', '伊達市', '北海道'), muni('07213', '伊達市', '福島県')];
    const entries = modeAEntries(date, true);
    // 保存は県ごとに2件
    expect(entries).toHaveLength(2);
    // 表示は1件
    expect(toQuestionResult(entries)).toMatchObject({ name: '伊達市', correct: true });
  });

  it('不正解フラグも保持される', () => {
    const entries = modeAEntries([muni('1', '川崎町', 'A県'), muni('2', '川崎町', 'B県')], false);
    expect(toQuestionResult(entries).correct).toBe(false);
  });

  it('19問（うち複数県の市が2問）のセッションで 表示=19 / 保存=21 になる', () => {
    // 通常の市17問（各1県）
    const singles: AnswerEntry[][] = Array.from({ length: 17 }, (_, i) => [
      { municipality: muni(`${1000 + i}`, `市${i}`, '東京都'), isCorrect: true, mode: 'B' as GameMode },
    ]);
    // 複数県の Mode A 2問（各2県 → 保存2件ずつ）
    const datePref = modeAEntries([muni('01233', '伊達市', '北海道'), muni('07213', '伊達市', '福島県')], true);
    const kawasaki = modeAEntries([muni('04324', '川崎町', '宮城県'), muni('40322', '川崎町', '福岡県')], false);

    const perQuestionEntries: AnswerEntry[][] = [...singles, datePref, kawasaki];

    // 表示: 1問1件
    const displayResults = perQuestionEntries.map((e) => toQuestionResult(e));
    expect(displayResults).toHaveLength(19);

    // 保存: entries の総数（複数県の市は県ごと）
    const saveCount = perQuestionEntries.reduce((n, e) => n + e.length, 0);
    expect(saveCount).toBe(21);
  });
});
