# Contract: Sound Effects Specification (Chord & Fanfare)

**Feature**: `029-rich-answer-feedback`  
**Date**: 2026-09-20  
**Status**: Active  
**Related**: `lib/quiz/sound-effects.ts`  

---

## 1. 概要

本契約は、Web Audio API による正解 SE の和音化（0.35秒以内）、連続正解数に応じた段階的ピッチ上昇（全音単位、最大4段階）、および5連続達成時のファンファーレ和音（0.34秒）の合成パラメータとインターフェースを定義する。

---

## 2. インターフェース契約 (`lib/quiz/sound-effects.ts`)

### 2.1 関数シグネチャ

```typescript
export interface CorrectSeOptions {
  /** 連続正解数（1〜）。未指定時は 1 として扱う */
  readonly streak?: number;
}

/**
 * 正解 SE を再生する。
 * - streak 1〜4: メジャーコード和音（全音単位でピッチ上昇、合計0.28秒）
 * - streak 5: ファンファーレ和音（オクターブ上を加えた展開、合計0.34秒）
 * - streak 6+: 4段階目の最高音程の和音SEを維持
 */
export function playCorrectSe(options?: CorrectSeOptions): void;

/**
 * 汎用 SE 再生関数。正解イベント時はオプションを受け付けるよう拡張。
 */
export function playSe(event: SeEvent, options?: CorrectSeOptions): void;
```

---

## 3. 音響設計と合成パラメータ (Synthesis Parameters)

### 3.1 通常正解和音 (Streak 1〜4, 6+)

- **基本周波数（Streak 1 = C6基準）**:
  - 根音 (C6): 1046.50 Hz
  - 第3音 (E6): 1318.51 Hz
  - 第5音 (G6): 1567.98 Hz
- **持続時間**: 合計 0.28 秒（各音の減衰含む）
- **波形**: `sine`（まろやかで心地よい音色）
- **ピッチシフト計算式 (FR-005b)**:
  - `shiftSemitones = Math.min(3, Math.max(0, streak - 1)) * 2`（0, 2, 4, 6 半音）
  - `freq(streak) = baseFreq * Math.pow(2, shiftSemitones / 12)`
  - Streak 1: C6 メジャー (C6, E6, G6)
  - Streak 2: D6 メジャー (D6, F#6, A6)
  - Streak 3: E6 メジャー (E6, G#6, B6)
  - Streak 4: F#6 メジャー (F#6, A#6, C#7)
  - Streak 6+: Streak 4 と同一の最高音程を維持

### 3.2 5連続達成時ファンファーレ (Streak === 5 のみ) (FR-005c)

- **構成**: 高速アルペジオ＋オクターブ上展開
- **合計再生時間**: 0.34 秒（0.35 秒以内を厳守）
- **トーンスケジュール**:
  1. t = 0.00s: C6 (1046.50 Hz) - duration 0.08s
  2. t = 0.06s: E6 (1318.51 Hz) - duration 0.08s
  3. t = 0.12s: G6 (1567.98 Hz) - duration 0.08s
  4. t = 0.18s: C7 (2093.00 Hz) + G6 (1567.98 Hz) 同時和音 - duration 0.16s
- **波形**: `triangle`（アタック感） + `sine`（広がり）のブレンド

### 3.3 音響不変条件

1. **再生時間制限**: 0.35秒以内を厳格に遵守（次のアクションやテンポを邪魔しない）。
2. **濁り防止**: 各オシレータのゲインは `linearRampToValueAtTime`（アタック 10ms）と `exponentialRampToValueAtTime`（ディケイ）により音の切れ際をきれいに収束させる。
3. **ミュート優先**: `isSoundMuted() === true` のときは Web Audio 処理を一切行わず即座に return する。
