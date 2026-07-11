# 実装計画書: 今日のおすすめクイズにおける地域選択（絞り込み）機能の改善

**ブランチ**: `011-recommend-region-filter` | **日付**: 2026-07-10 | **仕様書**: [spec.md](./spec.md)

---

## 概要

今日のおすすめクイズを開始する前の調整ダイアログ（`RecommendOverride`）において、特定の地方を選択（複数トグルによるポジティブ選択）して出題プールを絞り込めるようにします。  
また、おすすめ推薦における難易度の自動ステップアップについて、正答率だけでなく制覇率（coverage）も考慮するように改善します。

### 技術的アプローチ:
- `RecommendOverride` 内の地域選択 UI を「除外」から「対象トグル（ポジティブ選択）」へ変更し、選択された地方のみを出題対象とします。
- 選択状態は LocalStorage (`geodojo-recommend-region-filters`) に永続化します。
- 遷移時に URL クエリパラメータ `region` に地方パラメータを載せ、`/quiz/municipality/[mode]` で初期設定へパース・復元します。
- モードA（逆引き地図）またはモードB（逆引き4択）において、選択された地方に含まれる都道府県の合計が2つ未満（「北海道」のみ選択時）の場合、クイズ開始を無効化するガードロジック（`isModeAvailable` の拡張、および開始ボタンの Disabled 化と自動開始ガード）を実装します。
- 推薦エンジンの `evaluateProgression`（`lib/quiz/recommendation/axes/progression.ts`）に `cellCoverages` を渡し、現在の最高難易度（`maxDifficulty`）のセルの平均制覇率が 90% 未満の場合は難易度のステップアップ（`nextDifficulty` の適用）をロックし、既存難易度の未制覇問題の消化を優先させます。

---

## 技術的文脈

**言語/バージョン**: TypeScript (strict)、Next.js 15.2.6+（App Router / React 19）  
**主要な依存関係**: React (useState, useMemo), Tailwind CSS, lucide-react, LocalStorage  
**ストレージ**: LocalStorage（設定のキャッシュ保存）  
**テスト**: Vitest (`pnpm test`)。フィルタロジック、制覇率進行ロック、および `isModeAvailable` のテストを拡張します。  
**対象プラットフォーム**: PWA（モバイルファースト 375px 基準、ダークモード `#111111`）  
**プロジェクトタイプ**: Web アプリケーション  
**パフォーマンス目標**: 追加のネットワーク/DBアクセスは一切なし。クライアントサイドでのフィルタ適用時間は 1ms 未満を維持します。  
**制約事項**: 既存の推薦 API (`getRecommendation`) や Server Actions 自体のシグネチャ（引数・戻り値）を変更せず、フロントエンドおよび推薦計算ロジック（`evaluateProgression`）の拡張のみで完結させます。

---

## 憲法チェック (憲法原則の確認)

| 原則 | 評価 | 判定 |
|------|------|------|
| I. セキュリティ & コンプライアンス | APIキー、新規 API エンドポイント、外部通信等の追加なし。Next.js 15.2.6+ を維持。 | ✅ 合格 (Pass) |
| II. アーキテクチャ & パフォーマンス | 新しいDBクエリやServer Action、API Routes の追加なし。データは TanStack Query と URL クエリパラメータ経由で完結。 | ✅ 合格 (Pass) |
| III. ロジック & UI | 375px幅のモバイルボトムシート内で完結するよう、トグルバッジ群による地方ポジティブ選択UIを実装。Tailwind ユーティリティでスタイリング。 | ✅ 合格 (Pass) |
| IV. コーディング規約 | TypeScript strict を順守。フィルタロジックや進行判定は `lib/quiz/` の純粋関数を拡張しテストで検証。 | ✅ 合格 (Pass) |

---

## プロジェクト構成

### ドキュメント（本機能）

```text
specs/011-recommend-region-filter/
├── plan.md              # このファイル
├── research.md          # 調査結果
├── data-model.md        # データモデル定義
├── quickstart.md        # クイックスタートガイド
├── contracts/
│   └── region-filter.md # URLおよびUI状態連携契約
├── checklists/
│   └── requirements.md  # 仕様品質チェックリスト
└── tasks.md             # タスクリスト
```

### ソースコード（リポジトリルート）

```text
app/(app)/quiz/municipality/[mode]/
└── page.tsx                    # [変更] URL から region をパースし Settings / buildQuestions に反映。自動開始ガードの適用。

components/recommend/
├── recommend-override.tsx      # [変更] 地方トグルのポジティブ選択 UI および LocalStorage 保存（都道府県アコーディオンの廃止）
└── recommend-content.tsx       # [変更] URL 遷移時のパラメータに region を含める。無効な設定時の開始ボタン無効化。

lib/quiz/
├── municipality-data.ts        # [変更] isModeAvailable でモード A/B における1都道府県ガードをサポート
└── recommendation/
    ├── engine.ts               # [変更] evaluateProgression に cellCoverages を引き渡す
    └── axes/
        └── progression.ts      # [変更] 制覇率が 90% 未満の場合に難易度進行をロックする
```

**構成に関する決定**: 既存の Next.js 単一プロジェクトの構造（LIFT原則）を踏襲します。UI コンポーネントおよびクイズプレイ画面の変更、および推薦純粋関数の拡張のみで実現します。
