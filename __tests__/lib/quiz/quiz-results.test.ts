import { describe, it, expect } from 'vitest';
import {
  dedupeInstancesByPrefecture,
  type Municipality,
} from '@/lib/quiz/municipality-data';
import { toQuestionResult, toWeakResultItem, type AnswerEntry } from '@/lib/quiz/quiz-results';

function muni(code: string, name: string, prefecture: string, kana?: string): Municipality {
  return { code, name, prefecture, region: '', kana };
}

/** Mode A の1問に対する保存 entries（県ごとに代表1件）を組み立てる。 */
function modeAEntries(instances: Municipality[], isCorrect: boolean): AnswerEntry[] {
  return dedupeInstancesByPrefecture(instances).map((m) => ({
    municipality: m,
    isCorrect,
    mode: 'A',
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
      { municipality: muni(`${1000 + i}`, `市${i}`, '東京都'), isCorrect: true, mode: 'B' },
    ]);
    // 複数県の Mode A 2問（各2県 → 保存2件ずつ）
    const datePref = modeAEntries([muni('01233', '伊達市', '北海道'), muni('07213', '伊達市', '福島県')], true);
    const kawasaki = modeAEntries([muni('04324', '川崎町', '宮城県'), muni('40322', '川崎町', '福岡県')], false);

    const perQuestionEntries: AnswerEntry[][] = [...singles, datePref, kawasaki];

    // 表示: 1問1件
    const displayResults = perQuestionEntries.map((e) => toQuestionResult(e));
    expect(displayResults).toHaveLength(19);
    const sessionAccuracy =
      displayResults.filter((r) => r.correct).length / displayResults.length;
    expect(sessionAccuracy).toBeCloseTo(18 / 19);

    // 保存: entries の総数（複数県の市は県ごと）
    const saveCount = perQuestionEntries.reduce((n, e) => n + e.length, 0);
    expect(saveCount).toBe(21);
  });

  it('Mode D: 政令指定都市の区は区名と区の読み仮名へ正規化される', () => {
    const entry: AnswerEntry = {
      municipality: muni('01101', '札幌市', '北海道', 'さっぽろし'),
      isCorrect: true,
      mode: 'D',
    };
    const r = toQuestionResult([entry]);
    expect(r).toEqual({
      name: '札幌市中央区',
      prefecture: '北海道',
      correct: true,
      kana: 'さっぽろしちゅうおうく',
    });
  });

  it('Mode D: 一般自治体の場合は名称と読み仮名をそのまま維持する', () => {
    const entry: AnswerEntry = {
      municipality: muni('01343', '鹿部町', '北海道', 'しかべちょう'),
      isCorrect: false,
      mode: 'D',
    };
    const r = toQuestionResult([entry]);
    expect(r).toEqual({
      name: '鹿部町',
      prefecture: '北海道',
      correct: false,
      kana: 'しかべちょう',
    });
  });

  it('Mode B/C: 政令指定都市であっても親市名・親市読み仮名のまま維持される', () => {
    const entry: AnswerEntry = {
      municipality: muni('01101', '札幌市', '北海道', 'さっぽろし'),
      isCorrect: true,
      mode: 'B',
    };
    const r = toQuestionResult([entry]);
    expect(r).toEqual({
      name: '札幌市',
      prefecture: '北海道',
      correct: true,
      kana: 'さっぽろし',
    });
  });

  it('Mode A: 同名・同読の複数県は読み仮名と複数県名を正しく保持する', () => {
    const entries = modeAEntries(
      [
        muni('01233', '伊達市', '北海道', 'だてし'),
        muni('07213', '伊達市', '福島県', 'だてし'),
      ],
      true,
    );
    const r = toQuestionResult(entries);
    expect(r).toEqual({
      name: '伊達市',
      prefecture: '北海道・福島県',
      correct: true,
      kana: 'だてし',
    });
  });

  it('Mode A: 同名・異読の複数県は単一kanaに潰さず県ごとの読みを保持する', () => {
    const entries = modeAEntries(
      [
        muni('01331', '松前町', '北海道', 'まつまえちょう'),
        muni('38401', '松前町', '愛媛県', 'まさきちょう'),
      ],
      false,
    );
    const r = toQuestionResult(entries);
    expect(r).toEqual({
      name: '松前町',
      prefecture: '北海道: まつまえちょう / 愛媛県: まさきちょう',
      correct: false,
    });
  });

  it('Mode A: 一部の読みが未登録の場合は既知の読みのみ県と対応付ける', () => {
    const entries = modeAEntries(
      [
        muni('13206', '府中市', '東京都', 'ふちゅうし'),
        muni('34208', '府中市', '広島県'),
      ],
      false,
    );
    const r = toQuestionResult(entries);
    expect(r).toEqual({
      name: '府中市',
      prefecture: '東京都: ふちゅうし / 広島県',
      correct: false,
    });
  });

  it('Mode A: 全県の読みが未登録の場合は県名のみを結合する', () => {
    const entries = modeAEntries(
      [
        muni('04324', '川崎町', '宮城県'),
        muni('40322', '川崎町', '福岡県'),
      ],
      true,
    );
    const r = toQuestionResult(entries);
    expect(r).toEqual({
      name: '川崎町',
      prefecture: '宮城県・福岡県',
      correct: true,
    });
  });
});

describe('toWeakResultItem', () => {
  it('読み仮名がある場合は "読み仮名 / 都道府県" を detail に設定する', () => {
    const item = toWeakResultItem({
      name: '札幌市中央区',
      prefecture: '北海道',
      correct: false,
      kana: 'さっぽろしちゅうおうく',
    });
    expect(item).toEqual({
      name: '札幌市中央区',
      detail: 'さっぽろしちゅうおうく / 北海道',
    });
  });

  it('読み仮名がない場合は都道府県のみを detail に設定する', () => {
    const item = toWeakResultItem({
      name: '鹿部町',
      prefecture: '北海道',
      correct: false,
    });
    expect(item).toEqual({
      name: '鹿部町',
      detail: '北海道',
    });
  });

  it('Mode D の政令市区誤答結果から苦手一覧アイテムへ正しく変換される', () => {
    const entry: AnswerEntry = {
      municipality: muni('01101', '札幌市', '北海道', 'さっぽろし'),
      isCorrect: false,
      mode: 'D',
    };
    const questionResult = toQuestionResult([entry]);
    const weakItem = toWeakResultItem(questionResult);
    expect(weakItem).toEqual({
      name: '札幌市中央区',
      detail: 'さっぽろしちゅうおうく / 北海道',
    });
  });

  it('Mode A の同名・異読複数県の誤答結果から愛媛県側の読みを欠落させず苦手一覧アイテムへ変換される', () => {
    const entries = modeAEntries(
      [
        muni('01331', '松前町', '北海道', 'まつまえちょう'),
        muni('38401', '松前町', '愛媛県', 'まさきちょう'),
      ],
      false,
    );
    const questionResult = toQuestionResult(entries);
    const weakItem = toWeakResultItem(questionResult);
    expect(weakItem).toEqual({
      name: '松前町',
      detail: '北海道: まつまえちょう / 愛媛県: まさきちょう',
    });
  });

  it('Mode A の同名・同読複数県の誤答結果から苦手一覧アイテムへ変換される', () => {
    const entries = modeAEntries(
      [
        muni('01233', '伊達市', '北海道', 'だてし'),
        muni('07213', '伊達市', '福島県', 'だてし'),
      ],
      false,
    );
    const questionResult = toQuestionResult(entries);
    const weakItem = toWeakResultItem(questionResult);
    expect(weakItem).toEqual({
      name: '伊達市',
      detail: 'だてし / 北海道・福島県',
    });
  });
});
