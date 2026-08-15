# Quickstart & Verification: 018-fast-graduation-quality

## 1. 概要
本機能は解答時間（`answer_time_ms`）に基づく SM-2 `quality = 5` 評価と、それによる復習間隔加速および早期卒業判定（Phase 2/3）の実装です。

## 2. 自動テストの実行

```bash
# SRS 関連の単体テストを実行
pnpm test __tests__/lib/quiz/srs

# 全体テスト・型チェック・Lint
npx tsc --noEmit
pnpm test
pnpm lint:ratchet
```

## 3. テスト項目
- `determineReviewQuality`:
  - 不正解時 → `2`
  - 正解 & 5,000ms → `5`
  - 正解 & 10,000ms（境界） → `5`
  - 正解 & 10,001ms（境界） → `4`
  - 正解 & null / undefined → `4`
- `applySm2`:
  - q=5 で EF が +0.1 増加
  - q=5 かつ rep=3 かつ interval=16 → `graduated: true`
  - q=4 かつ rep=3 かつ interval=15 → `graduated: false`
- `computeSrsUpdate`:
  - `answerTimeMs` 引数が正しく quality 判定に渡り、SRS 更新結果に反映される
