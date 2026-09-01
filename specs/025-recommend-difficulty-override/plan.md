# 実装計画書: 今日のおすすめクイズにおける難易度変更（オーバーライド）機能

**フィーチャーブランチ**: `025-recommend-difficulty-override`  
**仕様書**: [spec.md](./spec.md)

---

## 概要

「今日のおすすめクイズ」調整ダイアログ（`RecommendOverride`）に難易度選択セクションを追加し、ユーザーが任意の難易度（☆入門、☆☆中級、☆☆☆上級、☆☆☆☆達人）を選択してクイズを開始できるようにします。

---

## 変更対象ファイル

1. `components/recommend/recommend-override.tsx`
   - `Overrides` 型に `difficulties: Difficulty[]` を追加
   - `Props.initial` に `difficulties: Difficulty[]` を追加
   - 難易度トグルUI（`DIFFICULTIES` + `DIFFICULTY_LABEL`）を追加
   - 状態管理および `onChange` 連携の実装

2. `components/recommend/recommend-content.tsx`
   - `effectiveDifficulties` を `overrides ? overrides.difficulties : data.difficulties` に更新
   - 難易度未選択（`effectiveDifficulties.length === 0`）時の開始ボタンバリデーション追加
   - `RecommendOverride` への `initial.difficulties` 渡し

3. `__tests__/components/recommend-override.test.ts` (新規または既存テスト更新)
   - 難易度選択、URLクエリ生成、バリデーションロジックの単体・統合テスト

---

## 実装ステップ

- **Step 1**: `components/recommend/recommend-override.tsx` を修正し、`difficulties` の状態とトグルUIを追加。
- **Step 2**: `components/recommend/recommend-content.tsx` を修正し、難易度オーバーライドの反映とバリデーションを追加。
- **Step 3**: 単体テストを追加し、難易度変更とガード動作を検証。
- **Step 4**: `pnpm type-check`, `pnpm lint`, `pnpm test` を実行して品質確認。
