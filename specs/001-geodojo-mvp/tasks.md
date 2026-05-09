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

- [x] T001 `pnpm create next-app@latest` で Next.js 15.2.6+ プロジェクトを作成（TypeScript・App Router・Tailwind CSS v4）
- [x] T002 依存関係をインストール：`@supabase/supabase-js drizzle-orm postgres @tanstack/react-query @vnedyalk0v/react19-simple-maps topojson-client @google/generative-ai @serwist/next serwist`（pnpm add）
- [x] T003 devDependencies をインストール：`drizzle-kit @types/topojson-client vitest @vitejs/plugin-react`（pnpm add -D）
- [x] T004 shadcn/ui を初期化（`pnpm dlx shadcn@latest init`）し、button card badge skeleton toast をインストール
- [x] T005 `.env.local` 設定済み（実施済み）
- [x] T006 国土地理院GeoJSONを取得し `public/japan.topojson` に変換済み（40.8KB）
- [x] T007 [P] `tailwind.config.ts` と `app/globals.css` を設定：ダークモード（`#111111`）をデフォルト、375px モバイルファーストのベーススタイル

---

## Phase 2: Foundational（全ストーリー共通の基盤）

**Purpose**: 全ユーザーストーリーに必要な共通インフラ。完了前にストーリー実装を開始してはならない。

**⚠️ CRITICAL**: Phase 2 完了前はどのユーザーストーリー実装も開始しないこと。

- [x] T008 Drizzle スキーマを定義する `lib/db/schema.ts`（cards・annotations・srs_records・ai_candidates の4テーブル、`srs_user_due_idx` 複合インデックス必須）
- [x] T009 `drizzle.config.ts` を作成し `pnpm drizzle-kit push` でスキーマを Supabase に適用
- [x] T010 Supabase Dashboard でRLSポリシーを4テーブル全てに適用済み（実施済み）
- [x] T011 [P] Drizzle DBクライアントを実装：`lib/db/index.ts`（`postgres-js` ドライバー、`prepare: false`）
- [x] T012 [P] Supabase クライアントを実装：`lib/supabase/client.ts`（browser/server 両用）
- [x] T013 TanStack Query の QueryClientProvider を実装：`app/providers.tsx`（`'use client'`、`staleTime: 60000`）
- [x] T014 Root レイアウトに Providers・ThemeProvider を設定：`app/layout.tsx`（PWA manifest メタタグ含む）
- [x] T015 [P] @serwist/next PWA 設定を適用：`next.config.ts`（`withSerwist`）と `app/sw.ts`（CacheFirst で `/japan.topojson` をキャッシュ）
- [x] T016 アプリシェルレイアウト（BottomNav: 学習・クイズ・カード・AIレビュー）を実装：`app/(app)/layout.tsx`
- [x] T017 Supabase Auth を使ったログイン・サインアップページを実装：`app/(auth)/login/page.tsx`・`app/(auth)/signup/page.tsx`
- [x] T018 認証ガード（未認証で `/login` リダイレクト）を `app/(app)/layout.tsx` に組み込む
- [x] T019 **画像プロキシ API を実装**：`app/api/image-proxy/route.ts`（Auth チェック・pano_id バリデーション・Google Maps API キーをサーバー側のみで使用）— 憲法 I 条

**Checkpoint**: Phase 2 完了 → 全ストーリーの実装を並列開始できる

---

## Phase 3: User Story 1 — SRS学習セッション (Priority: P1) 🎯 MVP

**Goal**: ユーザーがフラッシュカードで SM-2 間隔反復学習を行い、評価（1/3/5）後に次回出題日が更新される。

**Independent Test**: カードが1枚あり `/study` にアクセスしてカードが表示され、評価ボタンを押して次回出題日が変わればこのストーリーは完了。

### User Story 1 の実装

- [x] T020 [P] [US1] SM-2 簡略化アルゴリズムを実装：`lib/srs/algorithm.ts`（`calculateNextReview(record, rating: 1|3|5)` を export、research.md R-001 参照）
- [x] T021 [P] [US1] `useDueCards` フックを実装：`lib/hooks/useDueCards.ts`（`GET /api/cards/due` を queryFn に使用）
- [x] T022 [P] [US1] 当日期限カード取得 API を実装：`app/api/cards/due/route.ts`（due_date <= NOW() で srs_records + cards を JOIN、`srs_user_due_idx` 使用）
- [x] T023 [US1] `submitRating` API ルートを実装：`app/api/study/rate/route.ts`（algorithm を呼び出し srs_records を upsert）
- [x] T024 [P] [US1] `AnnotationOverlay` コンポーネントを実装：`components/flashcard/AnnotationOverlay.tsx`（SVG、`xRatio`/`yRatio` 相対座標でマーカー描画）
- [x] T025 [P] [US1] `MarkerPin` SVG コンポーネントを実装：`components/annotation/MarkerPin.tsx`（円＋ラベル、タップでラベル表示）
- [x] T026 [US1] `FlashCard` コンポーネントを実装：`components/flashcard/FlashCard.tsx`（画像表示 + AnnotationOverlay 重ね合わせ、panoId の場合は `/api/image-proxy` 経由で表示）
- [x] T027 [US1] `RatingButtons` コンポーネントを実装：`components/flashcard/RatingButtons.tsx`（「全然(1)」「うろ覚え(3)」「完璧(5)」3ボタン、タップ後は disabled）
- [x] T028 [US1] 学習セッションページを実装：`app/(app)/study/page.tsx`（useDueCards で取得 → FlashCard + RatingButtons → submitRating → 次カード。カード0件は「今日の学習は完了」表示）

**Checkpoint**: `/study` でカード表示・評価・次回日更新が動作 → User Story 1 完了・独立してデモ可能

---

## Phase 4: User Story 2 — 地図タップクイズ (Priority: P2)

**Goal**: 日本地図から都道府県をタップし、問題の都道府県に対して正誤判定が1秒以内に表示される。

**Independent Test**: `/quiz` にアクセスして地図が表示され、都道府県をタップして正誤フィードバックが表示されれば完了。

### User Story 2 の実装

- [x] T029 [P] [US2] `JapanMap` コンポーネントを実装：`components/map/JapanMap.tsx`（`'use client'`、`@vnedyalk0v/react19-simple-maps`、`/japan.topojson` を fetch で非同期ロード、各都道府県をタップ可能な Geography として描画）
- [x] T030 [P] [US2] `PrefectureLabel` — ハイライト処理は JapanMap に統合済み
- [x] T031 [US2] 地図タップクイズページを実装：`app/(app)/quiz/page.tsx`（問題出題 → JapanMap 表示 → タップ → 正誤判定 → 次の問題。クイズ終了後に正答率・苦手都道府県一覧表示）

**Checkpoint**: `/quiz` で地図タップ→即時フィードバック動作 → User Story 2 完了

---

## Phase 5: User Story 3 — 手動カード作成 (Priority: P3)

**Goal**: スクリーンショットをアップロードし、アノテーションを付けてカードを保存→SRS学習に利用できる。

**Independent Test**: `/cards/new` で画像をアップロード・メモ入力・保存後、`/study` または `/cards` に反映されれば完了。

### User Story 3 の実装

- [x] T032 [P] [US3] `AnnotationEditor` コンポーネントを実装：`components/annotation/AnnotationEditor.tsx`（`'use client'`、画像上のタップ位置を相対座標 0.0〜1.0 に変換してマーカー追加・削除、ラベル入力UI付き）
- [x] T033 [US3] カード作成ロジックを実装：`app/(app)/cards/new/page.tsx`（Supabase Storage に画像アップロード → POST /api/cards → cards INSERT → annotations INSERT → srs_records 初期状態 INSERT）
- [x] T034 [US3] カード作成ページを実装：`app/(app)/cards/new/page.tsx`（画像アップロードUI → AnnotationEditor → notes・tags 入力 → 保存ボタン）
- [x] T035 [P] [US3] `useCards` フックを実装：`lib/hooks/useCards.ts`（タグ配列でフィルタリング、`GET /api/cards` を queryFn に使用）
- [x] T036 [US3] カード一覧 API を実装：`app/api/cards/route.ts`（`?tags=東北,電柱` クエリパラメータ対応、`tags @> ARRAY[...]` で絞り込み）
- [x] T037 [US3] カード削除 API を実装：`app/api/cards/[id]/route.ts`（DELETE エンドポイント）
- [x] T038 [US3] カード一覧ページを実装：`app/(app)/cards/page.tsx`（タグフィルタUI + カードグリッド + 削除ボタン）

**Checkpoint**: `/cards/new` でカード作成 → `/study` または `/cards` に反映 → User Story 3 完了

---

## Phase 6: User Story 4 — AI生成カード候補レビュー (Priority: P4)

**Goal**: AI生成候補一覧でユーザーが承認/却下でき、承認したカードが SRS 学習に追加される。

**Independent Test**: `/ai-review` で候補が表示され、承認後に `/study` に追加されれば完了。

### User Story 4 の実装

- [x] T039 [P] [US4] Gemini 2.5 Flash ラッパーを実装：`lib/ai/gemini.ts`（`gemini-2.5-flash` モデル、画像解析プロンプト、JSON レスポンス `{ notes, suggestedTags }` を返す）
- [x] T040 [US4] AI生成 API ルートを実装：`app/api/ai-generate/route.ts`（ai_candidates INSERT → 非同期で Gemini 呼び出し → 結果を ai_candidates UPDATE、即時 `{ candidateId, status: "processing" }` を返す）
- [x] T041 [US4] 承認・却下 API を実装：`app/api/ai-candidates/[id]/route.ts`（承認: ai_candidates.status → 'approved' + cards INSERT + srs_records INSERT。却下: status → 'rejected'）
- [x] T042 [P] [US4] `AiReviewCard` コンポーネントを実装：`components/ai/AiReviewCard.tsx`（候補画像・提案メモ・提案タグ表示、メモ・タグ編集フォーム、承認・却下ボタン）
- [x] T043 [P] [US4] `useAiCandidates` フックを実装：`lib/hooks/useAiCandidates.ts`（`GET /api/ai-candidates` を queryFn に使用、`status=pending` でフィルタ）
- [x] T044 [US4] AI候補一覧 API を実装：`app/api/ai-candidates/route.ts`（status=pending のみ返す）
- [x] T045 [US4] AI候補レビューページを実装：`app/(app)/ai-review/page.tsx`（pending 件数バッジ、AiReviewCard 一覧、生成中ステータス表示）

**Checkpoint**: `/ai-review` で候補表示・承認・却下動作 → User Story 4 完了

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 全ストーリーに影響する品質改善。

- [x] T046 [P] `app/(app)/loading.tsx` + 各ページの Skeleton フォールバック追加済み
- [x] T047 [P] safe-area-inset・44px タップターゲット・ダークモード globals.css 適用済み
- [x] T048 [P] image-proxy にインメモリレート制限（100req/min）追加済み
- [x] T049 Supabase Realtime で ai_candidates の UPDATE を subscribe し `/ai-review` を自動更新
- [x] T050 `quickstart.md` の動作確認シナリオを手動実行し、全 Acceptance Scenarios をパスすることを確認

---

## Phase 8: Post-MVP バグ修正・UX改善

**Purpose**: MVP動作確認後に発見された不具合・UX問題の修正。

- [x] T051 [P] `/cards/new` に「✨ AIに提案させる」ボタンを追加（`app/(app)/cards/new/page.tsx`）
- [x] T052 [P] `AiReviewCard` の processing→pending 遷移時にフォームが空になる不具合を修正（`useEffect` で state 同期）
- [x] T053 [P] `FlashCard`・`AnnotationEditor` の縦長画像クロップ問題を修正（`aspect-video` + `object-cover`）
- [x] T054 `/study` ページの「残り -1 枚」バグを修正（`currentIndex` 廃止、常に `cards[0]` を表示）
- [x] T055 `/study` ページのレイアウト改善（評価ボタンを画面下部に固定、カードエリアをスクロール可能に）
- [x] T056 `react-easy-crop` を使った16:9クロップUI導入（`app/(app)/cards/new/page.tsx`）— アップロード前にユーザーが範囲調整可能
- [x] T057 [P] `FlashCard`・`AnnotationEditor`・`AiReviewCard` を `max-w-2xl mx-auto self-center aspect-video` で統一（Web/モバイル両対応）
- [x] T058 [P] `ai-generate` API の catch ブロックにエラーログを追加（デバッグ用）

---

## Phase 9: User Story 5 — 市区町村クイズ データアセット準備 (Priority: P5)

**Purpose**: 市区町村クイズが依存する静的データファイルを生成する。コード実装前に完了する必要がある。

- [ ] T059 [US5] MLIT 国土数値情報 N03 最新 Shapefile をダウンロードし、`ogr2ogr` + `mapshaper`（`-rename-fields nam_ja=N03_004,pref_ja=N03_001,code=N03_007` ）で `public/japan-municipalities.topojson` を生成する（research.md R-008 手順参照。実測サイズを plan.md に記録すること）
- [ ] T060 [P] [US5] `scripts/generate-municipalities.ts` を実装・実行して `public/municipalities.json` を生成する（約1741件、`code`/`name`/`prefecture`/`region` フォーマット、research.md R-011 参照。実測サイズを plan.md に記録すること）
- [ ] T061 [P] [US5] `scripts/generate-prefecture-center.ts` を実装・実行して `lib/quiz/prefecture-center.ts` を生成する（`d3-geo` の `geoBounds`/`geoCentroid` で BBox から自動計算、research.md R-010-bis 参照）

**Checkpoint**: T059〜T061 完了 → 静的データが揃い実装開始可能

---

## Phase 10: User Story 5 — 市区町村クイズ 基盤追加 (Priority: P5)

**Purpose**: US5 固有のデータベーステーブル・キャッシュ・出典表記を追加する。Phase 9 完了後に実施。

- [ ] T062 [US5] `lib/db/schema.ts` に `municipalityQuizResults` テーブル（`municipality_quiz_results`）を追加し `pnpm drizzle-kit push` を実行する（data-model.md の Drizzle スキーマ参照。`mqr_user_code_idx`・`mqr_user_time_idx` インデックス必須）
- [ ] T063 [US5] Supabase Dashboard で `municipality_quiz_results` テーブルに RLS ポリシー（`mqr_own`）を適用する（data-model.md「Supabase RLS（追加）」参照）
- [ ] T064 [P] `app/sw.ts` に `japan-municipalities.topojson` の `CacheFirst` ルールを追加する（`cacheName: 'map-data'`、`maxAgeSeconds: 2592000`）
- [ ] T065 [P] `app/layout.tsx` の footer に国土数値情報 PDL1.0 出典表記を追加する（FR-016：「『国土数値情報（行政区域データ）』（国土交通省）をもとに GeoDojo が加工して作成」を常時表示）

**Checkpoint**: T062〜T065 完了 → US5 実装開始可能

---

## Phase 11: User Story 5 — 市区町村クイズ 実装 (Priority: P5)

**Goal**: ユーザーが `/quiz/municipality` で モードA〜D・地域フィルター・苦手優先を使って市区町村クイズをプレイでき、結果が DB に記録される。

**Independent Test**: `/quiz/municipality` にアクセスしてモードBで1問出題・回答・結果画面表示が動作すれば独立して機能する。

### User Story 5 の実装

- [ ] T066 [P] [US5] `lib/quiz/municipality-data.ts` を実装する — `municipalities.json` の型定義・ロード関数・有効コード `Set`（バリデーション用）・地域フィルター関数・weighted random selection（苦手 `errorRate` を weight として適用）
- [ ] T067 [P] [US5] `components/map/MunicipalityMap.tsx` を実装する — `'use client'`・`/japan-municipalities.topojson` を fetch で非同期ロード・`pref_ja` フィルタで都道府県内のみ表示・`prefectureCenter[prefecture]` で初期ズーム・タップ可能な Geography・正解/不正解ハイライト props（`highlightCodes`・`wrongCodes`）・ズームコントロール（research.md R-010 参照）
- [ ] T068 [P] [US5] `lib/hooks/useMunicipalityWeakness.ts` を実装する — `getMunicipalityWeakness` Server Action を `useQuery` で呼び出す TanStack Query フック（`queryKey: ['municipality', 'weakness']`）
- [ ] T069 [US5] `app/(app)/quiz/municipality/actions.ts` を実装する — `saveMunicipalityQuizResult`（`mode` ホワイトリスト検証・`municipality_code` の `validCodes` Set 存在検証・60件/分インメモリレート制限・INSERT）と `getMunicipalityWeakness`（直近100件 error_rate 集計クエリ、contracts/server-actions.md 参照）
- [ ] T070 [US5] `app/(app)/quiz/municipality/page.tsx` を実装する — ① モード選択・地域フィルター・問題数・苦手優先の設定画面 → ② ゲームループ（モードA: JapanMap + 確認ボタン + 残数カウンタ / モードB: 都道府県4択ボタン / モードC: 同都道府県内4択ボタン / モードD: MunicipalityMap） → ③ 結果画面（正解数・正答率・苦手市区町村一覧）。各回答後に `saveMunicipalityQuizResult` を呼び出す
- [ ] T071 [US5] 既存 `app/(app)/quiz/page.tsx` に「市区町村クイズへ」リンクカードを追加する（`/quiz/municipality` へのナビゲーション）
- [ ] T072 [P] [US5] モードD フォールバックを実装する — `japan-municipalities.topojson` の fetch 失敗時にモードC へ自動切り替えし「地図データの読み込みに失敗しました（モードCで代替表示）」を表示する（Edge Case）

**Checkpoint**: `/quiz/municipality` でモードA〜D・地域フィルター・苦手優先が動作 → User Story 5 完了・独立してデモ可能

---

## Phase 12: User Story 5 — 検証

- [ ] T073 [US5] `/quiz/municipality` の全 Acceptance Scenarios（7シナリオ）を手動実行して確認する。特に同名市区町村（例: 府中市）の全選択フロー・残数カウンタ・「解答する」送信・DB 記録・苦手優先出題の動作を確認する

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
- **US5 (P5)**: Phase 9（データアセット T059〜T061）→ Phase 10（基盤 T062〜T065）→ Phase 11（実装 T066〜T072）の順。他 US への依存なし

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
- Phase 9（US5）: T060・T061 は T059 完了後に並列実行可能
- Phase 11（US5）: T066・T067・T068 は T069 着手前に並列実行可能

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
5. US5 追加 → 独立テスト → デプロイ（市区町村クイズで地理知識を深化）
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
