# Implementation Plan: 今日のおすすめクイズにおける地域選択（絞り込み）機能の改善

**Branch**: `011-recommend-region-filter` | **Date**: 2026-07-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/011-recommend-region-filter/spec.md`

## Summary

今日のおすすめクイズを開始する前の調整ダイアログ（`RecommendOverride`）において、特定の地方および都道府県を選択（ポジティブ選択）して出題プールを絞り込めるようにする。
また、おすすめ推薦における難易度の自動ステップアップについて、正答率だけでなく制覇率（coverage）も考慮するように改善する。

技術的アプローチとして：
- `RecommendOverride` 内の地域選択 UI を「除外」から「対象トグル」へ変更し、地方を選択するとその地方の都道府県リストが展開されるアコーディオン形式を実装する。
- 選択状態は LocalStorage (`geodojo-recommend-region-filters`) に永続化する。
- 遷移時に URL クエリパラメータ `region` および `prefectures` にパラメータを載せ、`/quiz/municipality/[mode]` で初期設定へパース・復元する。
- 出題生成ロジック `buildQuestions` に都道府県の絞り込み処理を追加し、指定された県のみから出題されるようにする。
- 推薦エンジンの `evaluateProgression`（`lib/quiz/recommendation/axes/progression.ts`）に `cellCoverages` を渡し、現在の最高難易度（`maxDifficulty`）のセルの平均制覇率が 90% 未満の場合は難易度のステップアップ（`nextDifficulty` の適用）をロックし、既存難易度の未制覇問題の消化を優先させる。

## Technical Context

**Language/Version**: TypeScript (strict)、Next.js 15.2.6+（App Router / React 19）  
**Primary Dependencies**: React (useState, useMemo), Tailwind CSS, lucide-react, LocalStorage  
**Storage**: LocalStorage（設定のキャッシュ保存）  
**Testing**: Vitest (`pnpm test`)。フィルタロジック、制覇率進行ロック、および `isModeAvailable` のテストを拡張する。  
**Target Platform**: PWA（モバイルファースト 375px 基準、ダークモード `#111111`）  
**Project Type**: Web application  
**Performance Goals**: 追加のネットワーク/DBアクセスは一切なし。クライアントサイドでのフィルタ適用時間は 1ms 未満を維持。  
**Constraints**: 既存の推薦 API (`getRecommendation`) や Server Actions 自体のシグネチャ（引数・戻り値）を変更せず、フロントエンドおよび推薦計算ロジック（`evaluateProgression`）の拡張のみで完結させる。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 評価 | 判定 |
|------|------|------|
| I. セキュリティ & コンプライアンス | APIキー、新規 API エンドポイント、外部通信等の追加なし。Next.js 15.2.6+ を維持。 | ✅ Pass |
| II. アーキテクチャ & パフォーマンス | 新しいDBクエリやServer Action、API Routes の追加なし。データは TanStack Query と URL クエリパラメータ経由で完結。 | ✅ Pass |
| III. ロジック & UI | 375px幅のモバイルボトムシート内で完結するよう、アコーディオンで展開可能な都道府県トグルボタンを実装。Tailwind ユーティリティでスタイリング。 | ✅ Pass |
| コーディング規約 | TypeScript strict を順守。フィルタロジックや進行判定は `lib/quiz/` の純粋関数を拡張しテストで検証。 | ✅ Pass |

## Project Structure

### Documentation (this feature)

```text
specs/011-recommend-region-filter/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── region-filter.md # URLおよびUI状態連携契約
├── checklists/
│   └── requirements.md  # spec 品質チェックリスト
└── tasks.md             # /speckit-tasks で生成
```

### Source Code (repository root)

```text
app/(app)/quiz/municipality/[mode]/
└── page.tsx                    # [変更] URL から prefectures をパースし Settings / buildQuestions に反映

components/recommend/
├── recommend-override.tsx      # [変更] 地域・都道府県のポジティブ選択 UI および LocalStorage 保存
└── recommend-content.tsx       # [変更] URL 遷移時のパラメータに prefectures を含める

lib/quiz/
├── municipality-data.ts        # [変更] isModeAvailable を都道府県指定にも対応させる
└── recommendation/
    ├── engine.ts               # [変更] evaluateProgression に cellCoverages を引き渡す
    └── axes/
        └── progression.ts      # [変更] 制覇率が 90% 未満の場合に難易度進行をロックする
```

**Structure Decision**: 既存の Next.js 単一プロジェクトの構造（LIFT原則）を踏襲する。UI コンポーネントおよびクイズプレイ画面の変更、および推薦純粋関数の拡張のみで実現する。
