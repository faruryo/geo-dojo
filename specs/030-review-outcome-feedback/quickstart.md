# Quickstart: 復習完了時のSRS進捗・定着可視化

## 自動テスト

```bash
pnpm test -- __tests__/lib/quiz/srs __tests__/components/quiz/use-quiz-actions-advance.test.tsx
pnpm type-check && pnpm lint:ratchet
```

確認すること:

- `simulation.test.ts`: 誤答歴なし（rep 0/1）、誤答直後（EF 2.18 で3回）、EF 下限 1.3、壊れた値（NaN）で `null` になること。
- `snapshot.test.ts`: モード whitelist、コード形式、0件・101件、重複の畳み込み。
- `outcome.test.ts`: [data-model.md](./data-model.md) の判定表の全7ラベル、Mode A 片県卒業が「復習継続」になること、`定着 + 復習継続 + 保存失敗 = 問題数`、整合ガード（件数・番号・コード集合の不一致）、`post` 欠落でフォールバック。
- `use-quiz-actions-advance.test.tsx`: 保存成功・失敗それぞれで `onComplete` の第2引数に `QuestionSaveMeta` が問題順に渡ること。

## 手動確認（ローカルスタック）

前提: `supabase start`、`municipality_master` 投入済み、`test@example.com` / `password123` でログイン。

1. 通常クイズ（Mode B）で数問をわざと誤答し、Mode A で伊達市など同名多県の問題を含めて解いて、`srs_records` を作る。
2. Studio（http://127.0.0.1:54323）で対象行の `due_date` を過去日に更新し、due にする。
3. `/quiz/review` を開いて解き終える。
4. 完了画面で次を確認する。
   - サマリのチップ件数の合計が分母（回答数）と一致する。
   - 「問題ごとの結果」を開くと、各行のラベルが Studio の `srs_records`（status / due_date）と一致する。
   - 伊達市など Mode A の多県問題は県ごとの行で表示される。
   - 375px 幅（DevTools のデバイスモード）で横スクロールが出ない。
5. フォールバック確認: DevTools の Network を Offline にしてから完了させると、従来の「まだ苦手な市区町村」表示になり、画面は壊れない。

本番 DB には書き込まない。Preview で確認する場合も、自分のアカウントで通常どおり復習を解くだけにする。
