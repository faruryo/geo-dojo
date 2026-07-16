# データモデル: クイズ効果音（SE）の追加

本機能では、**データベーススキーマの変更は行わない**（新規テーブル・新規カラム・マイグレーションなし）。
サーバー側に保存する状態は一切なく、永続化は端末の localStorage のみ（spec Assumptions「永続化の範囲」）。

spec.md の Key Entities（効果音イベント・ミュート設定）を実装可能な型・状態として定義する。

---

## データ構造 (Entities)

### 1. `SeEvent`（効果音イベント）

`lib/quiz/sound-effects.ts` に定義する、効果音の再生トリガー種別。spec Key Entities「効果音イベント」の4種類に1対1対応する。

```typescript
export type SeEvent = 'correct' | 'incorrect' | 'complete' | 'perfect';
```

| 値 | 意味 | 発火タイミング | 対応FR |
|----|------|----------------|--------|
| `correct` | 正解 | 1問の解答が正解と判定されたとき | FR-001 |
| `incorrect` | 不正解 | 1問の解答が不正解と判定されたとき（モードDのタイムアウト含む） | FR-002 |
| `complete` | クイズ完了（通常） | 最終問題を終え結果画面へ遷移するとき（全問正解でない場合） | FR-003 |
| `perfect` | クイズ完了（全問正解） | 同上（全問正解の場合。`complete` の**代わり**に鳴る。重ねて鳴らさない） | FR-004 |

- 各イベントに対応する音のパラメータ（波形・周波数列・エンベロープ・長さ）は `sound-effects.ts` 内の定数として定義する。具体値は実装時のデザイン判断（spec Assumptions「音の性格」: 短い・控えめ・不快でない。`correct`/`incorrect` は明確に聞き分け可能、`perfect` は `complete` より際立った演出）。
- 音源データ（ファイル）は存在しない。すべて Web Audio API でコード生成する（research.md Decision 1）。

### 2. ミュート設定（localStorage）

端末（ブラウザ）単位で保持する二値の状態。すべてのクイズ画面に横断適用される単一の設定（FR-009）。

| 項目 | 値 |
|------|----|
| ストレージ | `window.localStorage` |
| キー | `geo-dojo:se-muted` |
| 値 | `'true'`（ミュート中）のみを意味のある値とする。それ以外・キー不在は「音あり」 |
| 初期値（キー不在時） | **音あり**（Clarifications 確定: デフォルトで音あり） |
| フォールバック | localStorage 不可用（プライベートモード等）時は try/catch で吸収し、常に「音あり」・永続化なしとして動作 |

```typescript
// lib/quiz/sound-effects.ts
export function isSoundMuted(): boolean;            // localStorage を直読み。不可用時は false
export function setSoundMuted(muted: boolean): void; // localStorage へ書き込み。不可用時は何もしない
```

- **React 側の状態**: UI（トグルアイコン）表示用に `lib/hooks/useSoundMuted.ts` の `useSoundMuted()` が `[muted, setMuted]` を提供する。`setMuted` は `setSoundMuted` を呼んで localStorage と React state を同時更新する。
- **再生側の参照**: `playSe(event)` は React state を経由せず、呼び出しごとに `isSoundMuted()` を直接評価する（research.md Decision 2）。これにより同一画面内でトグル直後の解答から即座に反映され、画面間の設定不整合も起きない。

### 3. モジュール内部状態（永続化しない）

`lib/quiz/sound-effects.ts` がモジュールスコープに保持する実行時状態。ページリロードで消えてよい。

```typescript
let audioContext: AudioContext | null = null; // 初回 playSe 時に遅延生成し再利用
```

- SSR 安全性: モジュール評価時には AudioContext を生成しない（`'use client'` 環境でも初回呼び出しまで遅延）。

---

## 影響範囲の確認（振る舞い不変を保証する観点)

| 対象 | 変更前 | 変更後 | 期待される差分 |
|------|--------|--------|----------------|
| DB スキーマ（`lib/db/schema.ts`） | — | 変更なし | なし |
| `QuizRunner` の props / `onComplete` / `onAbort` シグネチャ | — | 変更なし | 呼び出し元（`municipality/[mode]/page.tsx`・`review/page.tsx`）は無変更 |
| 正誤判定・結果集計・SRS スケジューリング | — | 変更なし | `playSe` は判定結果を読むだけで書き換えない |
| フィードバック表示時間（1200/1500ms）・遷移タイミング | — | 変更なし | `playSe` は同期 fire-and-forget（FR-007 / SC-005） |
| localStorage | 既存キー（推薦履歴・地域フィルタ・マイルストーン） | `geo-dojo:se-muted` を追加 | 既存キーとの衝突なし |
