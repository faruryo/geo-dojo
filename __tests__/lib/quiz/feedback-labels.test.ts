import { describe, expect, it } from 'vitest';
import { formatModeAFeedback, formatSingleFeedback } from '@/lib/quiz/feedback-labels';
import type { Municipality } from '@/lib/quiz/municipality-data';

function municipality(
  code: string,
  name: string,
  prefecture: string,
  kana?: string,
): Municipality {
  return { code, name, prefecture, region: '', kana };
}

describe('formatModeAFeedback', () => {
  it('単一自治体は市区町村名の読みと正解都道府県を表示する', () => {
    const instances = [
      municipality('01343', '鹿部町', '北海道', 'しかべちょう'),
    ];

    expect(formatModeAFeedback('鹿部町', instances))
      .toBe('鹿部町（しかべちょう） （正解: 北海道）');
  });

  it('同名・同読の複数県は読みを重複させず正解都道府県を列挙する', () => {
    const instances = [
      municipality('13206', '府中市', '東京都', 'ふちゅうし'),
      municipality('34208', '府中市', '広島県', 'ふちゅうし'),
    ];

    expect(formatModeAFeedback('府中市', instances))
      .toBe('府中市（ふちゅうし） （正解: 東京都・広島県）');
  });

  it('同名・異読の複数県は都道府県と読みを対応付ける', () => {
    const instances = [
      municipality('01331', '松前町', '北海道', 'まつまえちょう'),
      municipality('38401', '松前町', '愛媛県', 'まさきちょう'),
    ];

    expect(formatModeAFeedback('松前町', instances))
      .toBe('松前町 （正解: 北海道: まつまえちょう / 愛媛県: まさきちょう）');
  });

  it('一部の読みが未登録でも既知の読みを別県へ誤対応させない', () => {
    const instances = [
      municipality('01331', '松前町', '北海道', 'まつまえちょう'),
      municipality('38401', '松前町', '愛媛県'),
    ];

    expect(formatModeAFeedback('松前町', instances))
      .toBe('松前町 （正解: 北海道: まつまえちょう / 愛媛県）');
  });

  it('読みが全件未登録なら名称と正解都道府県だけを表示する', () => {
    const instances = [
      municipality('13206', '府中市', '東京都'),
      municipality('34208', '府中市', '広島県'),
    ];

    expect(formatModeAFeedback('府中市', instances))
      .toBe('府中市 （正解: 東京都・広島県）');
  });

  it('インスタンスが空なら名称だけを返す', () => {
    expect(formatModeAFeedback('不明町', [])).toBe('不明町');
  });
});

describe('formatSingleFeedback', () => {
  it('Mode D: 政令指定都市の区は区名と区の読み仮名を表示する', () => {
    const muni = municipality('01101', '札幌市', '北海道', 'さっぽろし');
    expect(formatSingleFeedback(muni, 'D')).toBe('札幌市中央区（さっぽろしちゅうおうく）');
  });

  it('Mode D: 政令指定都市以外の一般自治体は名称と読み仮名を表示する', () => {
    const muni = municipality('01343', '鹿部町', '北海道', 'しかべちょう');
    expect(formatSingleFeedback(muni, 'D')).toBe('鹿部町（しかべちょう）');
  });

  it('Mode D: 読み仮名がない場合は名称のみを表示する', () => {
    const muni = municipality('01343', '鹿部町', '北海道');
    expect(formatSingleFeedback(muni, 'D')).toBe('鹿部町');
  });

  it('Mode D: 地図ロード失敗でMode Cにフォールバックした場合（effectiveMode=C）は親市名と親市読み仮名を表示する', () => {
    const muni = municipality('01101', '札幌市', '北海道', 'さっぽろし');
    expect(formatSingleFeedback(muni, 'D', 'C')).toBe('札幌市（さっぽろし）');
  });

  it('Mode B: 自治体名（読み仮名）と正解都道府県を表示する', () => {
    const muni = municipality('01101', '札幌市', '北海道', 'さっぽろし');
    expect(formatSingleFeedback(muni, 'B')).toBe('札幌市（さっぽろし） （正解: 北海道）');
  });

  it('Mode C: 自治体名（読み仮名）を表示する', () => {
    const muni = municipality('01101', '札幌市', '北海道', 'さっぽろし');
    expect(formatSingleFeedback(muni, 'C')).toBe('札幌市（さっぽろし）');
  });
});

