# 内部契約: クイズ効果音（SE）の追加

本機能は外部公開 API・DB を持たないため、関数間・コンポーネント間の内部契約（いつ・どの関数が・どのイベントで呼ばれるべきか）として以下を定義する。

---

## 1. `playSe` 契約

**場所**: `lib/quiz/sound-effects.ts`

```typescript
function playSe(event: SeEvent): void;  // SeEvent = 'correct' | 'incorrect' | 'complete' | 'perfect'
```

**事前条件**:
- なし（クライアントコンポーネントのイベントハンドラ／コールバック内から任意のタイミングで呼んでよい）。

**事後条件**:
- `isSoundMuted() === true` の場合、**AudioContext の生成・resume を含む一切の再生処理を行わない**（SC-004: ミュート中はいかなる効果音も再生されない）。
- 非ミュート時、`event` に対応する効果音の再生を試みる。AudioContext はモジュール内で遅延生成・再利用し、`suspended` なら `resume()` を試みる。
- **同期的に即座に return する**（再生完了・失敗を await しない）。呼び出し元の処理時間を増やさない（FR-007）。
- 生成・resume・再生のいずれが失敗しても**例外を呼び出し元へ伝播させない**。エラーを UI に表面化させない（FR-012。デバッグ用の `console.debug` 程度は可、`console.error` は不可）。
- 前の効果音の再生中に呼ばれた場合、重なり・打ち切りのいずれでもよいが、呼び出し自体は上記と同じく即座に return する（spec Edge Cases）。

**呼び出し元**: `components/quiz/quiz-runner.tsx`、`app/(app)/quiz/prefecture/page.tsx`（下記 4・5）。

---

## 2. ミュート設定 契約

**場所**: `lib/quiz/sound-effects.ts`（読み書き関数）、`lib/hooks/useSoundMuted.ts`（UI 用フック）

```typescript
function isSoundMuted(): boolean;
function setSoundMuted(muted: boolean): void;
function useSoundMuted(): [muted: boolean, setMuted: (muted: boolean) => void];
```

**事後条件**:
- `isSoundMuted` は localStorage キー `geo-dojo:se-muted` を読み、`'true'` のときのみ `true` を返す。キー不在・localStorage 不可用・SSR 環境では `false`（音あり）を返す（Clarifications: デフォルト音あり）。例外を投げない。
- `setSoundMuted` は同キーへ書き込む。localStorage 不可用時は静かに何もしない（例外を投げない）。
- `useSoundMuted` の `setMuted` は、localStorage（`setSoundMuted`）と React state を同時に更新する。次のレンダーでトグルアイコンに反映され、**同時に次の `playSe` 呼び出しから即座に反映される**（`playSe` は localStorage を直読みするため、React の再レンダーを待たない）。
- 設定は単一キーであり、市区町村クイズ・復習セッション・都道府県クイズのどの画面で切り替えても全画面に適用される（FR-009 / US3 シナリオ5）。

---

## 3. `MuteToggle` UI 契約

**場所**: `components/quiz/mute-toggle.tsx`

```typescript
function MuteToggle(): JSX.Element;  // props なし（設定はグローバル単一のため）
```

| 状態 | 表示 | タップ時の動作 |
|------|------|----------------|
| 音あり（`muted === false`） | スピーカーアイコン（lucide `Volume2`） | ミュートに切り替え（`setMuted(true)`） |
| ミュート中（`muted === true`） | ミュートアイコン（lucide `VolumeX`） | ミュート解除（`setMuted(false)`）。以後の解答・完了で音が復帰（US3 シナリオ4） |

**注記**:
- ワンタップで切り替わること（SC-003）。確認ダイアログ等は挟まない。
- 既存ヘッダ行（`text-xs text-muted-foreground`）に馴染むサイズ・色とし、`aria-label`（例:「効果音をミュート」/「ミュートを解除」）を付与する。
- 切り替え操作自体で効果音を鳴らすかは実装裁量（鳴らす場合は解除時のみ。ミュート操作時に鳴らしてはならない）。

**配置箇所**（FR-008: クイズ画面上の操作）:
- `components/quiz/quiz-runner.tsx` のヘッダ行（現在「中断 / 進捗 / 正解数」を並べている `flex items-center justify-between` の行）。モードA と モードB/C/D の両レイアウトに含めること。
- `app/(app)/quiz/prefecture/page.tsx` のプレイ中ヘッダ行（「round / 正解数」の行）。結果画面への配置は不要。

---

## 4. `QuizRunner` 統合契約（市区町村クイズ モードA〜D・復習セッション共通）

**場所**: `components/quiz/quiz-runner.tsx`

| # | フックポイント | 呼び出し | 条件 |
|---|----------------|----------|------|
| 4-1 | `handleModeASubmit` 内、`setFeedback(correct ? 'correct' : 'incorrect')` と同じ箇所 | `playSe(correct ? 'correct' : 'incorrect')` | モードA の解答確定時 |
| 4-2 | `handleBChoice` 内、同上 | 同上 | モードB の選択時 |
| 4-3 | `handleCChoice` 内、同上 | 同上 | モードC の選択時 |
| 4-4 | `handleDTap` 内、同上 | 同上 | モードD の地図タップ時 |
| 4-5 | `handleTimeout` 内、`setFeedback('incorrect')` と同じ箇所 | `playSe('incorrect')` | モードD のタイムアウト時（FR-002。ユーザー操作を伴わない発火だが、`playSe` が失敗を吸収するため進行はブロックされない） |
| 4-6 | `advanceQuestion` 内、`onComplete(updatedResults)` の**直前**（`completedRef` ガードの内側） | `playSe(updatedResults.every((r) => r.correct) ? 'perfect' : 'complete')` | 最終問題の遷移時のみ（FR-003 / FR-004）。`complete` と `perfect` は排他（どちらか一方のみ鳴る） |

**不変条件**:
- `onAbort` 経路（中断ボタン）ではいかなる `playSe` も呼ばない（FR-005）。
- `playSe` の追加により `recordAndAdvance` の `delayMs`（1200/1500ms）・`setTimeout` の構造・`saveMunicipalityQuizResult` の呼び出しを変更しない（FR-007 / spec Assumptions「既存挙動への影響」）。
- `onComplete` / `onAbort` / props のシグネチャを変更しない。呼び出し元 `app/(app)/quiz/municipality/[mode]/page.tsx`・`app/(app)/quiz/review/page.tsx` は**無変更**。
- 復習セッションの連続プレイでは、各バッチが独立に 4-6 を通過するため、バッチ完了ごとに完了音が鳴る（FR-003 / US2 シナリオ4。追加実装不要であることの確認）。

---

## 5. 都道府県クイズ 統合契約

**場所**: `app/(app)/quiz/prefecture/page.tsx`（QuizRunner 非使用の独立実装）

| # | フックポイント | 呼び出し | 条件 |
|---|----------------|----------|------|
| 5-1 | `handleTap` 内、`setState(isCorrect ? 'correct' : 'wrong')` と同じ箇所 | `playSe(isCorrect ? 'correct' : 'incorrect')` | 地図タップによる解答時 |
| 5-2 | `handleTap` 内の `setTimeout` コールバック、`round >= TOTAL_ROUNDS` 分岐で `setState('result')` の直前 | `playSe(allCorrect ? 'perfect' : 'complete')` | 最終ラウンド終了→結果画面遷移時のみ。全問正解判定は最新の解答を含む結果配列で行うこと（state の `results` はクロージャで古い場合があるため、`handleTap` 冒頭で組んだ最新配列を用いる） |

**不変条件**:
- QuizRunner と**同じ `playSe`・同じ `SeEvent`** を用いる（FR-006: 同じ意味のイベントには画面をまたいで同じ音）。都道府県クイズ専用の音を定義しない。
- 「クイズ選択に戻る」リンク等での離脱時は完了音を鳴らさない（FR-005 相当。5-2 が `result` 遷移時のみ発火するため構造的に保証される）。
- 1200ms の `setTimeout`・出題キュー・`restart` の挙動を変更しない。

---

## 6. テスト契約

**場所**: `__tests__/lib/quiz/sound-effects.test.ts`

| 検証項目 | 内容 |
|----------|------|
| ミュートゲート | `isSoundMuted() === true` のとき `playSe` が再生パイプライン（AudioContext 生成含む）へ到達しないこと |
| デフォルト値 | localStorage キー不在時に `isSoundMuted()` が `false`（音あり）を返すこと |
| 永続化 | `setSoundMuted(true)` → `isSoundMuted() === true`、`setSoundMuted(false)` → `false` |
| フォールバック | localStorage が例外を投げる環境で `isSoundMuted`/`setSoundMuted`/`playSe` が例外を投げないこと |
| 完了イベント判定 | 結果配列 → `'perfect'`/`'complete'` の選択ロジック（全問正解のときのみ `'perfect'`） |

実音の聞こえ方（聞き分け・音量感・テンポ非破壊）は [quickstart.md](../quickstart.md) の手動検証で確認する。
