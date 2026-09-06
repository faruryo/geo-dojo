import { describe, it, expect } from 'vitest';
import {
  sessionUsesImmersiveLayout,
  type ImmersiveLayoutQuestion,
} from '@/lib/quiz/immersive-layout';

const modeA: ImmersiveLayoutQuestion = { kind: 'A' };
const modeB: ImmersiveLayoutQuestion = { kind: 'BCD', mode: 'B' };
const modeC: ImmersiveLayoutQuestion = { kind: 'BCD', mode: 'C' };
const modeD: ImmersiveLayoutQuestion = { kind: 'BCD', mode: 'D' };

describe('sessionUsesImmersiveLayout', () => {
  it('県当て（A）だけのセッションはフルスクリーン枠を使う', () => {
    expect(sessionUsesImmersiveLayout([modeA, modeA])).toBe(true);
  });

  it('場所当て（D）だけのセッションはフルスクリーン枠を使う', () => {
    expect(sessionUsesImmersiveLayout([modeD, modeD])).toBe(true);
  });

  it('4択（B / C）だけのセッションは通常レイアウトのままにする', () => {
    expect(sessionUsesImmersiveLayout([modeB, modeC, modeB])).toBe(false);
  });

  it('A と 4択が混在する復習セッションはフルスクリーン枠を使う', () => {
    expect(sessionUsesImmersiveLayout([modeB, modeA, modeC])).toBe(true);
  });

  it('D と 4択が混在する復習セッションはフルスクリーン枠を使う', () => {
    expect(sessionUsesImmersiveLayout([modeC, modeC, modeD])).toBe(true);
  });

  it('地図問題が最後の1問だけでもフルスクリーン枠を使う', () => {
    expect(sessionUsesImmersiveLayout([modeB, modeB, modeB, modeD])).toBe(true);
  });

  it('空のセッションは通常レイアウトのままにする', () => {
    expect(sessionUsesImmersiveLayout([])).toBe(false);
  });
});
