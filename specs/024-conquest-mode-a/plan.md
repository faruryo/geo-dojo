# Implementation Plan: 制覇は県当て地図と場所当て地図、おすすめはA/D抽選

**Branch**: `024-conquest-mode-a` | **Date**: 2026-08-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/024-conquest-mode-a/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

トップの全国制覇をモード横断の足し算から、県当て（A）と場所当て（D）の別バーにする。おすすめは Fit Zone エンジンをやめ、A/D を 50% で選んだあと地方×難易度マスの 90% 穴を埋める。A 引きかつ直近 A セッション（開始〜退出、時間近接で結合しない）の正答率が現行閾値（30% 未満）のときだけ B/C 練習へ1回差し替える。モード D は出題・正誤・地図タップ・未クリアを市区町村コード単位にし、政令市区は区付きラベルと区界タップを必須とする。詳細分析ページは作らない。

## Technical Context

**Language/Version**: TypeScript 5.x strict / React 19 / Next.js 15.2.6+

**Primary Dependencies**: TanStack Query v5, Server Actions, Drizzle, TopoJSON + Google Maps Data layer（Mode D 地図）

**Storage**: 既存 PostgreSQL（`municipality_quiz_results` の mode 別正解）。苦戦メタは localStorage（recommendation history 拡張）。新テーブルなし

**Testing**: Vitest。抽選・D identity・表示1問正規化は pure 関数＋ケース表。地図マージは既存 map テストを拡張

**Target Platform**: Web / PWA、375px、ダークモード `#111111`

**Project Type**: Web application（App Router）

**Performance Goals**: おすすめは退出時 invalidate。トップは A/D の既存 completion クエリ2本。TopoJSON は非同期のまま

**Constraints**: `public/` の実行時 fs 読み禁止。D 区名はビルド時 import。Preview は本番 DB 共有のため破壊的 migration を入れない。保存失敗は握り潰さない

**Scale/Scope**: ダッシュボード1面、モード選択1面、おすすめエンジン、Mode D ランナー／地図、サンプリング identity。都道府県クイズは対象外

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. セキュリティ & コンプライアンス**: 新規 API キーなし。制覇・クリアは既存どおり認証ユーザーの `user_id` スコープ。新 user テーブルなし（RLS 追加なし）
- [x] **II. アーキテクチャ & パフォーマンス**: Read=TanStack Query、Write=既存 Server Action。地図は TopoJSON 非同期。おすすめ判断は pure＋RNG 注入
- [x] **III. ロジック & UI**: 375px・ダーク。回答前に D の区が分かる。トップはおすすめと A/D のみ

**Post-design re-check**: 同一。Complexity Tracking 空。

## Project Structure

### Documentation (this feature)

```text
specs/024-conquest-mode-a/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── recommend-engine.md
│   ├── mode-d-map.md
│   └── dashboard-top.md
└── tasks.md              # /speckit-tasks — 本コマンドでは作らない
```

### Source Code (repository root)

```text
lib/quiz/recommendation/
├── engine.ts                 # generateRecommendation を A/D 抽選＋差し替えに置換
├── coverage-cells.ts         # 新: モード別地方×難易度マス制覇率（A=name、D=code）
└── history-cache.ts          # lastA / last B/C / swapConsumed を拡張

lib/quiz/
├── sampling.ts               # D identity をコード単位に分離（B/C は022のまま）
├── municipality-questions.ts # D は name::pref 重複排除しない
└── location-labels.ts        # 新: コード→区付きラベル（ビルド時 JSON）

components/quiz/use-quiz-actions.ts   # D 正誤は code 一致
components/map/MunicipalityMap.tsx    # nam_ja 結合をやめ code 結合のみ
components/dashboard/dashboard-client.tsx
components/dashboard/completion-progress.tsx
app/(app)/quiz/municipality/page.tsx  # モード日本語
app/(app)/quiz/municipality/[mode]/page.tsx  # 退出時 recommendation invalidate
lib/hooks/useRecommendation.ts

__tests__/lib/quiz/
├── recommendation-conquest-lottery.test.ts
├── sampling.test.ts          # D コード単位の回帰
└── location-labels.test.ts
```

**Structure Decision**: 既存の単一 Next.js アプリ。おすすめは `lib/quiz/recommendation`、D はランナーと地図、トップは dashboard コンポーネント。Fit Zone / progression / exploration はおすすめ経路から外す（削除は tasks で必要最小限。デッドコード掃除は本機能の必須ではない）。

## Complexity Tracking

> Constitution 違反なし。
