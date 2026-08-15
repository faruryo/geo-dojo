# Quickstart & Verification: 020-prefecture-quiz-enhancement

## 1. 概要
本機能は都道府県クイズの設定機能（地域選択・出題数・苦手優先）とタイムアタックモード（クリアタイム計測・自己ベスト保存）の実装です。

## 2. 自動テストの実行

```bash
# 都道府県クイズロジックのテスト
pnpm test __tests__/lib/quiz/prefecture-quiz.test.ts

# 全体検証
npx tsc --noEmit
pnpm test
pnpm lint:ratchet
```

## 3. UI 動作確認項目
- `/quiz/prefecture` を開く：
  - 設定画面が表示される（地域・出題数・モード・苦手優先）
  - 「関東」を選択し「スタート」→ 関東の都県のみが出題されること
  - 「タイムアタック」を選択しスタート → タイマーが表示され、完了後にクリアタイムと自己ベストが表示されること
