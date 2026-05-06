---
description: "GeoDojo MVP Phase 1 — SRS学習・地図クイズ・カード作成・AI生成レビュー"
---

# Tasks: GeoDojo MVP（Phase 1）

**Input**: Design documents from `specs/001-geodojo-mvp/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅

**Tests**: テストタスクは仕様に明示的な指定がないため含みません。

**Organization**: タスクはユーザーストーリー単位でグループ化され、各ストーリーを独立して実装・確認できます。

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: 並列実行可能（異なるファイル、依存なし）
- **[Story]**: 対応するユーザーストーリー（US1〜US4）
- ファイルパスを全タスクに明記

---

## Phase 1: Setup（プロジェクト初期化）

**Purpose**: 開発環境の初期構築。全フェーズの土台。

- [ ] T001 `pnpm create next-app@latest` で Next.js 15.2.6+ プロジェクトを作成（TypeScript・App Router・Tailwind CSS v4）
- [ ] T002 依存関係をインストール：`@supabase/supabase-js drizzle-orm postgres @tanstack/react-query @vnedyalk0v/react19-simple-maps topojson-client @google/generative-ai @serwist/next serwist`（pnpm add）
- [ ] T003 devDependencies をインストール：`drizzle-kit @types/topojson-client vitest @vitejs/plugin-react`（pnpm add -D）
- [ ] T004 shadcn/ui を初期化（`pnpm dlx shadcn@latest init`）し、button card badge skeleton toast をインストール
- [ ] T005 `.env.local` を作成し、`DATABASE_URL・NEXT_PUBLIC_SUPABASE_URL・NEXT_PUBLIC_SUPABASE_ANON_KEY・SUPABASE_SERVICE_ROLE_KEY・GOOGLE_MAPS_API_KEY・GEMINI_API_KEY` を設定（`GOOGLE_MAPS_API_KEY` と `GEMINI_API_KEY` に `NEXT_PUBLIC_` を付けないこと）
- [ ] T006 国土地理院GeoJSONを取得し `mapshaper` で `public/japan.topojson` に変換（目標サイズ 200KB 以下）
- [ ] T007 [P] `tailwind.config.ts` と `app/globals.css` を設定：ダークモード（`#111111`）をデフォルト、375px モバイルファーストのベーススタイル

---

## Phase 2: Foundational（全ストーリー共通の基盤）

**Purpose**: 全ユーザーストーリーに必要な共通インフラ。完了前にストーリー実装を開始してはならない。

**⚠️ CRITICAL**: Phase 2 完了前はどのユーザーストーリー実装も開始しないこと。

- [ ] T008 Drizzle スキーマを定義する `lib/db/schema.ts`（cards・annotations・srs_records・ai_candidates の4テーブル、`srs_user_due_idx` 複合インデックス必須）
- [ ] T009 `drizzle.config.ts` を作成し `pnpm drizzle-kit push` でスキーマを Supabase に適用
- [ ] T010 Supabase Dashboard でRLSポリシーを4テーブル全てに適用（`data-model.md` の SQL 参照）
- [ ] T011 [P] Drizzle DBクライアントを実装：`lib/db/index.ts`（`postgres-js` ドライバー、`prepare: false`）
- [ ] T012 [P] Supabase クライアントを実装：`lib/supabase/client.ts`（browser/server 両用）
- [ ] T013 TanStack Query の QueryClientProvider を実装：`app/providers.tsx`（`'use client'`、`staleTime: 60000`）
- [ ] T014 Root レイアウトに Providers・ThemeProvider を設定：`app/layout.tsx`（PWA manifest メタタグ含む）
- [ ] T015 [P] @serwist/next PWA 設定を適用：`next.config.ts`（`withSerwist`）と `app/sw.ts`（CacheFirst で `/japan.topojson` をキャッシュ）
- [ ] T016 アプリシェルレイアウト（BottomNav: 学習・クイズ・カード・AIレビュー）を実装：`app/(app)/layout.tsx`
- [ ] T017 Supabase Auth を使ったログイン・サインアップページを実装：`app/(auth)/login/page.tsx`・`app/(auth)/signup/page.tsx`
- [ ] T018 認証ガード（未認証で `/login` リダイレクト）を `app/(app)/layout.tsx` に組み込む
- [ ] T019 **画像プロキシ API を実装**：`app/api/image-proxy/route.ts`（Auth チェック・pano_id バリデーション・Google Maps API キーをサーバー側のみで使用）— 憲法 I 条

**Checkpoint**: Phase 2 完了 → 全ストーリーの実装を並列開始できる

---

## Phase 3: User Story 1 — SRS学習セッション (Priority: P1) 🎯 MVP

**Goal**: ユーザーがフラッシュカードで SM-2 間隔反復学習を行い、評価（1/3/5）後に次回出題日が更新される。

**Independent Test**: カードが1枚あり `/study` にアクセスしてカードが表示され、評価ボタンを押して次回出題日が変わればこのストーリーは完了。

### User Story 1 の実装

- [ ] T020 [P] [US1] SM-2 簡略化アルゴリズムを実装：`lib/srs/algorithm.ts`（`calculateNextReview(record, rating: 1|3|5)` を export、research.md R-001 参照）
- [ ] T021 [P] [US1] `useDueCards` フックを実装：`lib/hooks/useDueCards.ts`（`GET /api/cards/due` を queryFn に使用）
- [ ] T022 [P] [US1] 当日期限カード取得 API を実装：`app/api/cards/due/route.ts`（due_date <= NOW() で srs_records + cards を JOIN、`srs_user_due_idx` 使用）
- [ ] T023 [US1] `submitRating` Server Action を実装：`app/(app)/study/actions.ts`（T020 の algorithm を呼び出し srs_records を upsert）
- [ ] T024 [P] [US1] `AnnotationOverlay` コンポーネントを実装：`components/flashcard/AnnotationOverlay.tsx`（SVG、`xRatio`/`yRatio` 相対座標でマーカー描画）
- [ ] T025 [P] [US1] `MarkerPin` SVG コンポーネントを実装：`components/annotation/MarkerPin.tsx`（円＋ラベル、タップでラベル表示）
- [ ] T026 [US1] `FlashCard` コンポーネントを実装：`components/flashcard/FlashCard.tsx`（画像表示 + AnnotationOverlay 重ね合わせ、panoId の場合は `/api/image-proxy` 経由で表示）
- [ ] T027 [US1] `RatingButtons` コンポーネントを実装：`components/flashcard/RatingButtons.tsx`（「全然(1)」「うろ覚え(3)」「完璧(5)」3ボタン、タップ後は disabled）
- [ ] T028 [US1] 学習セッションページを実装：`app/(app)/study/page.tsx`（useDueCards で取得 → FlashCard + RatingButtons → submitRating → 次カード。カード0件は「今日の学習は完了」表示）

**Checkpoint**: `/study` でカード表示・評価・次回日更新が動作 → User Story 1 完了・独立してデモ可能

---

## Phase 4: User Story 2 — 地図タップクイズ (Priority: P2)

**Goal**: 日本地図から都道府県をタップし、問題の都道府県に対して正誤判定が1秒以内に表示される。

**Independent Test**: `/quiz` にアクセスして地図が表示され、都道府県をタップして正誤フィードバックが表示されれば完了。

### User Story 2 の実装

- [ ] T029 [P] [US2] `JapanMap` コンポーネントを実装：`components/map/JapanMap.tsx`（`'use client'`、`@vnedyalk0v/react19-simple-maps`、`/japan.topojson` を fetch で非同期ロード、各都道府県をタップ可能な Geography として描画）
- [ ] T030 [P] [US2] `PrefectureLabel` コンポーネントを実装：`components/map/PrefectureLabel.tsx`（正解: 緑ハイライト、不正解: 赤ハイライト + 正解都道府県名表示）
- [ ] T031 [US2] 地図タップクイズページを実装：`app/(app)/quiz/page.tsx`（問題出題 → JapanMap 表示 → タップ → 正誤判定 → 次の問題。クイズ終了後に正答率・苦手都道府県一覧表示）

**Checkpoint**: `/quiz` で地図タップ→即時フィードバック動作 → User Story 2 完了

---

## Phase 5: User Story 3 — 手動カード作成 (Priority: P3)

**Goal**: スクリーンショットをアップロードし、アノテーションを付けてカードを保存→SRS学習に利用できる。

**Independent Test**: `/cards/new` で画像をアップロード・メモ入力・保存後、`/study` または `/cards` に反映されれば完了。

### User Story 3 の実装

- [ ] T032 [P] [US3] `AnnotationEditor` コンポーネントを実装：`components/annotation/AnnotationEditor.tsx`（`'use client'`、画像上のタップ位置を相対座標 0.0〜1.0 に変換してマーカー追加・削除、ラベル入力UI付き）
- [ ] T033 [US3] `createCard` Server Action を実装：`app/(app)/cards/new/actions.ts`（Supabase Storage に画像アップロード → cards INSERT → annotations INSERT → srs_records 初期状態 INSERT）
- [ ] T034 [US3] カード作成ページを実装：`app/(app)/cards/new/page.tsx`（画像アップロードUI → AnnotationEditor → notes・tags 入力 → 保存ボタン）
- [ ] T035 [P] [US3] `useCards` フックを実装：`lib/hooks/useCards.ts`（タグ配列でフィルタリング、`GET /api/cards` を queryFn に使用）
- [ ] T036 [US3] カード一覧 API を実装：`app/api/cards/route.ts`（`?tags=東北,電柱` クエリパラメータ対応、`tags @> ARRAY[...]` で絞り込み）
- [ ] T037 [US3] `deleteCard`・`updateCardTags` Server Actions を実装：`app/(app)/cards/actions.ts`
- [ ] T038 [US3] カード一覧ページを実装：`app/(app)/cards/page.tsx`（タグフィルタUI + カードグリッド + 削除ボタン）

**Checkpoint**: `/cards/new` でカード作成 → `/study` または `/cards` に反映 → User Story 3 完了

---

## Phase 6: User Story 4 — AI生成カード候補レビュー (Priority: P4)

**Goal**: AI生成候補一覧でユーザーが承認/却下でき、承認したカードが SRS 学習に追加される。

**Independent Test**: `/ai-review` で候補が表示され、承認後に `/study` に追加されれば完了。

### User Story 4 の実装

- [ ] T039 [P] [US4] Gemini 2.5 Flash ラッパーを実装：`lib/ai/gemini.ts`（`gemini-2.5-flash` モデル、画像解析プロンプト、JSON レスポンス `{ notes, suggestedTags }` を返す）
- [ ] T040 [US4] AI生成 API ルートを実装：`app/api/ai-generate/route.ts`（ai_candidates INSERT → 非同期で Gemini 呼び出し → 結果を ai_candidates UPDATE、即時 `{ candidateId, status: "processing" }` を返す）
- [ ] T041 [US4] `approveCandidate`・`rejectCandidate` Server Actions を実装：`app/(app)/ai-review/actions.ts`（承認: ai_candidates.status → 'approved' + cards INSERT + srs_records INSERT。却下: status → 'rejected'）
- [ ] T042 [P] [US4] `AiReviewCard` コンポーネントを実装：`components/ai/AiReviewCard.tsx`（候補画像・提案メモ・提案タグ表示、メモ・タグ編集フォーム、承認・却下ボタン）
- [ ] T043 [P] [US4] `useAiCandidates` フックを実装：`lib/hooks/useAiCandidates.ts`（`GET /api/ai-candidates` を queryFn に使用、`status=pending` でフィルタ）
- [ ] T044 [US4] AI候補一覧 API を実装：`app/api/ai-candidates/route.ts`（status=pending のみ返す）
- [ ] T045 [US4] AI候補レビューページを実装：`app/(app)/ai-review/page.tsx`（pending 件数バッジ、AiReviewCard 一覧、生成中ステータス表示）

**Checkpoint**: `/ai-review` で候補表示・承認・却下動作 → User Story 4 完了

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 全ストーリーに影響する品質改善。

- [ ] T046 [P] 全主要操作のローディング状態と Suspense フォールバックを追加（`<Skeleton />` コンポーネント使用）
- [ ] T047 [P] モバイル最適化：タップターゲット最小 44px・スクロールパフォーマンス・iOS Safari 対応（safe-area-inset）
- [ ] T048 [P] `app/api/image-proxy/route.ts` にレート制限を追加（ユーザーあたり1分100件）
- [ ] T049 Supabase Realtime でAI生成完了通知を `/ai-review` ページに実装（`ai_candidates` テーブルの status 変更を subscribe）
- [ ] T050 `quickstart.md` の動作確認シナリオを手動実行し、全 Acceptance Scenarios をパスすることを確認

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存なし — 即開始可能
- **Foundational (Phase 2)**: Phase 1 完了後 — 全ユーザーストーリーをブロック
- **US1 (Phase 3)**: Phase 2 完了後 — 他ストーリーへの依存なし
- **US2 (Phase 4)**: Phase 2 完了後 — 他ストーリーへの依存なし
- **US3 (Phase 5)**: Phase 2 完了後 — 他ストーリーへの依存なし
- **US4 (Phase 6)**: Phase 2 完了後 + US3 推奨（画像アップロード機能を再利用）
- **Polish (Phase 7)**: 実装したい全ストーリー完了後

### User Story Dependencies

- **US1 (P1)**: Foundation 完了後、単独で開始可能
- **US2 (P2)**: Foundation 完了後、単独で開始可能（US1と並列可）
- **US3 (P3)**: Foundation 完了後、単独で開始可能
- **US4 (P4)**: Foundation 完了後、US3 の画像アップロード（T033）完了推奨

### Within Each User Story

- アルゴリズム/ロジック（T020, T039）→ Server Actions が依存
- API Routes → TanStack Query フックが依存
- UI コンポーネント（[P]）→ ページコンポーネントが依存
- Foundation の schema（T008）→ 全 DB 操作が依存

### Parallel Opportunities

- Phase 1 の `[P]` タスク（T007）は独立して実行可能
- Phase 2 の `[P]` タスク（T011, T012, T015）は独立して実行可能
- Phase 3: T020・T021・T024・T025 は同時実行可能（異なるファイル）
- Phase 4: T029・T030 は同時実行可能
- Phase 5: T032・T035 は同時実行可能
- Phase 6: T039・T042・T043 は同時実行可能
- US1・US2・US3 は Phase 2 完了後に並列で進められる

---

## Parallel Example: User Story 1

```bash
# Phase 2 完了後、以下を並列で開始:
Task T020: "SM-2アルゴリズムを実装 lib/srs/algorithm.ts"
Task T021: "useDueCarsフックを実装 lib/hooks/useDueCards.ts"
Task T022: "cards/due API route を実装 app/api/cards/due/route.ts"
Task T024: "AnnotationOverlayコンポーネントを実装 components/flashcard/AnnotationOverlay.tsx"
Task T025: "MarkerPinコンポーネントを実装 components/annotation/MarkerPin.tsx"

# 上記完了後:
Task T023: "submitRating Server Actionを実装 app/(app)/study/actions.ts" (T020依存)
Task T026: "FlashCardコンポーネントを実装 components/flashcard/FlashCard.tsx" (T024, T025依存)
Task T027: "RatingButtonsコンポーネントを実装 components/flashcard/RatingButtons.tsx"

# 全て完了後:
Task T028: "学習セッションページを実装 app/(app)/study/page.tsx"
```

---

## Implementation Strategy

### MVP First（User Story 1 のみ）

1. Phase 1: Setup 完了
2. Phase 2: Foundational 完了（全ストーリーのブロッカー）
3. Phase 3: User Story 1 完了
4. **STOP & VALIDATE**: `/study` で学習セッションが動作することを確認
5. 動作確認後にデプロイ/デモ可能

### Incremental Delivery

1. Setup + Foundational → 基盤完成
2. US1 追加 → 独立テスト → デプロイ（MVP！）
3. US3 追加 → 独立テスト → デプロイ（カード作成でコンテンツ充実）
4. US2 追加 → 独立テスト → デプロイ（クイズで学習を補完）
5. US4 追加 → 独立テスト → デプロイ（AI生成でコンテンツ自動化）

### Parallel Team Strategy

Phase 2 完了後:
- Developer A: US1（SRS学習）
- Developer B: US2（地図クイズ）
- Developer C: US3（カード作成）

---

## Notes

- `[P]` タスク = 異なるファイル、他タスクへの依存なし
- `[Story]` ラベルでトレーサビリティを保証（spec.md のユーザーストーリーと対応）
- 各ユーザーストーリーは独立して完成・テスト可能
- **セキュリティ必須**: T019（画像プロキシ）は Phase 2 に含まれ、全実装より先に完成させること
- commit は各タスクまたは論理グループ完了時に実施
- 各 Checkpoint で独立動作を確認してから次フェーズに進む
