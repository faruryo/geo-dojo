# Phase 1 Quickstart: 受け入れの検証手順

**Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md) | **Date**: 2026-09-06

実装後にこの順で通す。自動テストで守れるものは S0 に、目で見るしかないものを S1 以降に置いた。

## 前提

```bash
supabase start                  # DB:54322 / API:54321 / Studio:54323
pnpm dev                        # http://127.0.0.1:3000
```

- `municipality_master` が空だとクイズが成立しない。新しいローカル環境なら
  `pnpm tsx scripts/sync-municipality-master.ts` → `pnpm tsx scripts/import-municipality-kana.ts`。
- ログインは `test@example.com` / `password123`。
- **`localhost` ではなく `127.0.0.1:3000` で開く**（`supabase/config.toml` の `site_url` と揃える）。
- 検証は Chrome DevTools のデバイスツールバーで **375×812・ダークモード**にして行う。

---

## S0: 自動テスト

```bash
pnpm test
pnpm type-check
pnpm lint:ratchet
```

**期待**:

- 新規 `__tests__/lib/quiz/immersive-layout.test.ts` — セッション種別の判定
  （A のみ / D のみ / 4択のみ / 混在 / 空配列）。
- 新規 `__tests__/lib/quiz/hud-metrics.test.ts` — `resolveIntroPlan` の2分岐と
  `bottomBandHeightPx` の3分岐。
- 新規 `__tests__/components/quiz/hud-layout.test.tsx`（happy-dom）— immersive のとき
  `BottomNav` と出典 footer が DOM に無いこと。
- **既存 `__tests__/lib/quiz/answer-time.test.ts` が緑のままであること**。
  ここが赤くなったら FR-024 / FR-050 を破っている。

`.agents/rules/testing.instructions.md` に従い、新規回帰テストは
一度条件を反転させて**実際に赤くなること**を確認してから戻す。

---

## S1: フルスクリーン枠（US1 / FR-001〜008）

1. `/quiz/municipality/d` → 設定はそのままスタート。
2. 上端の帯・地図・下端の帯だけが見えること。**ボトムナビと出典 footer が無い**こと。
3. 帯と帯の間を上下にドラッグ→**ページがスクロールしない**（地図がパンする）。
4. 同じことを `/quiz/municipality/a` と `/quiz/prefecture`（スタート後）で確認。
5. `/quiz/municipality/b` を開始 → **ボトムナビが出たまま**であること（FR-006）。

**SC-007 の計測**: D で地図コンテナの高さを DevTools で読み、この変更前
（`git stash` して比較、または `16b6184` をチェックアウト）の値と比べて 130% 以上。

---

## S2: お題の導入表示（US2 / FR-020〜023）

1. D を開始した瞬間、お題が**画面中央に大きく**出る。
2. 約1秒後、下端へ縮みながら移動し、1行の小さな表示になる。
3. 下端の帯をタップ → **また中央に大きく出る**。3回繰り返しても同じ（FR-022 / SC-010）。
4. DevTools → Rendering → *Emulate CSS media feature prefers-reduced-motion* を `reduce` に。
   次の問題で**移動が起きず**、最初の 2.5 秒だけ帯と文字が大きくなること（FR-023 / SC-011）。

---

## S3: タイマーの起点（FR-024 — 最重要）

1. D を開始。中央にお題が出ている間、上端の残り時間バーが**減っていない**こと。
   導入が終わってから減り始める。
2. 下端タップで再表示 → **残り時間は止まらず減り続ける**こと。
   （止まったら実装が `armed` を戻している。無制限になる）
3. `/quiz/prefecture` のタイムアタックで、経過タイムが**開始直後から**動くこと
   （導入表示の有無に関係しない）。
4. D を1問、**10秒以内に正解**して回答。Supabase Studio（http://127.0.0.1:54323）で
   `municipality_quiz_results` の `answer_time_ms` が **10000 未満**であること。
   ここが 10000 を超えると SM-2 の quality=5 判定（`FAST_ANSWER_THRESHOLD_MS`）から外れ、
   定着間隔が静かに変わる。

---

## S4: 下端 HUD とフィードバック（FR-025〜028 / SC-008）

1. D で不正解になる自治体をタップ。下端に**よみがな付き**の正解が出る（FR-026）。
2. 正解・不正解を何度か繰り返し、**下端の帯の高さが変わらない**こと（SC-008）。
   DevTools で帯の要素の高さを固定表示にして見比べる。
3. A（県当て）で、同名複数県の問題（例: 伊達市、府中市、大和町）を出す。
   最長形が折り返しても**帯からはみ出さない**こと。はみ出したら
   `BOTTOM_BAND_FEEDBACK_PX`（実測で確定した 56px）を測り直す（research D11）。
4. A で都道府県を複数選択 → 下端は**件数1行**のみで、選ぶたびに高さが変わらないこと（FR-028）。
5. 確定ボタンのラベルが「あと N か所選択」→「解答する」と変わること（FR-040）。

---

## S5: 地図とのすり合わせ（FR-030〜036 / SC-012）

1. D で、**下端 HUD が画面最下端に密着**し、その下に地図が覗く隙間がないこと。
2. 同時に、**Google のロゴと著作権表記が帯の直上に見えている**こと（SC-012）。
   隠れていたら Google Maps Platform の規約違反。
3. ズームボタンが**右側面の垂直中央付近**にあり、上下の帯と重ならないこと（FR-033）。
   A の SVG 地図でも同じ位置。
4. 帯の背景が**完全に不透明**で、下の地図が透けていないこと（FR-035）。
5. D で不正解 → 自動フォーカスが働いたとき、正解の自治体が**帯に隠れない位置**に来ること（FR-034）。
   隠れる場合は Google Maps のリサイズ追随を確認する（research D8）。

---

## S6: 復習セッション（US4 / SC-009）

1. `/quiz/review` を開始。A・B/C・D が混ざるバッチを引く
   （引けないときは Studio で `srs_records` の `due_date` を過去日にして作る。
   **本番 DB では絶対にやらない**。ローカルスタックのみ）。
2. セッションを最初から最後まで通し、**ヘッダー／ボトムナビの表示状態が一度も変わらない**こと。
3. 4択の問題で、選択肢が**下端 HUD の領域**に出ること（FR-029）。

---

## S7: 中断と復帰（US3 / FR-007 / FR-014）

1. 出題中に上端の中断を押す → **確認が1段出る**（1タップで抜けない）。
2. 取り消す → 出題に戻る。
3. 承認する → フルスクリーンが解け、**ボトムナビと出典 footer が戻る**。
4. 全問終了 → 結果画面が既存のカード型で出て、枠も通常に戻る。
5. ブラウザの戻るボタンでも同じく枠が戻ること（`usePopstateGuard` 経路）。

---

## S8: アクセシビリティ（FR-037〜039 / SC-013）

1. DevTools の Inspect → Accessibility でコントラスト比を読む。
   HUD 内の通常文字が **7:1 以上**、最小 12px 以上（SC-013）。
2. 正否がアイコンの**形**（チェックと×）でも区別できること。
   DevTools → Rendering → *Emulate vision deficiencies* → Achromatopsia で確認。
3. 中断・確定・ズームの各ボタンが 44×44px 以上（SC-002）。

---

## S9: 出典（FR-041）

1. 出題中は出典 footer が見えないこと。
2. 中断して `/quiz` や `/`、分析画面へ戻ると**出典 footer が見えている**こと。
   ここが消えていたら FR-041 違反（`AppShell` のフラグが戻っていない）。
