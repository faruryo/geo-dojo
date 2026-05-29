# Phase 0 Research: おすすめクイズ

**Branch**: `003-adaptive-quiz` | **Date**: 2026-05-28

Technical Context に `NEEDS CLARIFICATION` は残っていないが、技術選定・既存資産再利用・推薦アルゴリズムの実装方針を確定するため以下を整理する。

## R-001: セッション境界の推定方式

### Decision

`municipality_quiz_results.answeredAt` の連続行を **「同一 `userId` × 同一 `mode` × 直前行との時間差 ≤ 30 分」** でグルーピングし、グループ内行数が 10/20/30 のいずれかに一致したら 1 セッションとみなす。一致しないグループは「混合セッション」とラベル付けし、セル別正答率移動平均から除外する（spec FR-006 のセル所属判定基準 50% 以上のため）。

### Rationale

- spec-002（学習ダッシュボード）の Edge Case で同一方針が採用済みであり、既存実装と一貫性が取れる。
- 30 分以上空けたプレイは「別セッション」とみなすのが自然（spec § Edge Cases の「直近プレイから時間が空いた場合」とも整合）。
- 設定問題数（10/20/30）一致を要件とすることで、中断・離脱を除外できる。

### Alternatives considered

- **A: セッション ID を新カラムとして追加** — スキーマ変更が必要で spec の Assumption に反する。却下。
- **B: 任意の連続行を 1 セッションとして扱う** — 中断・離脱混入で正答率が歪む。却下。
- **C: 5 分以内の連続のみセッション扱い** — 真剣にプレイした連続を捉えるが、考え込む時間を含めると 5 分は短すぎる。30 分が妥当。

## R-002: セル別正答率移動平均の計算アルゴリズム

### Decision

1. ユーザーの全セッションを R-001 で抽出。
2. 各セッションについて、セッション内の `(municipality_master.difficulty, region(municipality_master.region), mode)` タプルの分布を集計。
3. **同一タプルが 50% 以上を占める** セッションを「そのタプル（セル）に属する」と判定。占有率 50% 未満は混合として除外。
4. 各セル内で「セッション正答率（正答数 / 問題数）」を時系列順に並べ、**直近 5 セッションの単純移動平均** を取る。
5. データ不足セル（過去セッション数 < 3）は隣接セルバックオフ:
   - 1 段目: 同モード × 同難易度（全地方平均）
   - 2 段目: 同モード × 全難易度（全地方平均）
   - 3 段目: 全モード × 全難易度（このユーザー全体平均）
6. 完全未プレイ（全レベルでデータゼロ）は `municipality_master.difficulty` バケットに対する **クラウド平均**（全ユーザーの正答率を集計）で初期化する。

### Rationale

- spec Clarifications で確定済み（Q1 / Q2 答え）。
- 単純移動平均は重み付き移動平均より単純で、ヒューリスティクスの本質を見やすい。
- バックオフ順序を「データ密度が高い方向 → 低い方向」とすることで、推定精度を可能な限り維持。
- クラウド平均は推薦実行時にリアルタイム集計しても、難易度別 4 バケットのみで `COUNT FILTER` 一発で済む（既存 `mm_difficulty_idx` 使用、ms オーダーで完了）。

### Alternatives considered

- **A: 指数加重移動平均（EWMA）** — 直近重視で良い一方、パラメータ（減衰係数）が増えてチューニング難。シンプルな単純移動平均で十分。
- **B: 全期間累積平均** — 古いプレイの影響が消えず、ユーザーの上達が反映されない。却下。

## R-003: 適切ゾーン（Fit Zone）の抽出と昇格判定

### Decision

- セル別正答率移動平均（R-002）が **60% ≤ x ≤ 80%** に収まるセル集合を Fit Zone とする。
- 成長軸の発火条件（FR-006b）: Fit Zone 内のすべての難易度バケットが「現在の最高難易度バケット」と一致し、かつそのバケットでの移動平均が **直近 5 セッション平均 > 80%** に張り付いている。
- 発火時の追加アクション: 難易度を **次の隣接バケット（☆→☆☆→☆☆☆→☆☆☆☆）** に拡張。同じモード・同じ地方の隣接セルを Fit Zone に追加し、推薦プールを拡張。
- 達人（☆☆☆☆）でこれ以上拡張できない場合、**別地方への広域化を優先**、それでも Fit Zone が広がらない場合に副次的にモード変更（4 択系 → 地図系 or 順引き ↔ 逆引きで難度高めへ）。
- 後退抑制（FR-006d）: 直近 1 セッションの正答率 < 30% なら、当該 CTA 呼び出しに限り成長軸を保留。

### Rationale

- spec Clarifications で「主要 X」概念は廃止、Fit Zone（集合）で置換確定。
- 隣接単方向制約は spec FR-006b で確定（スキップ禁止）。
- 達人天井時の選択順序（別地方広域化 → モード変更）は、ユーザーが地理学習を主目的としていることを尊重する。

### Alternatives considered

- **A: モード変更を成長軸の主アクションにする** — spec Clarifications で「モード変更は同一難易度内の挑戦バリエーション」と明示済み。却下。
- **B: 達人天井時にランダム挑戦モードへ即フォールバック** — エッジ感が強くゲーム性を損なう。広域化 → モード変更の順がユーザー体験的に自然。

## R-004: 推薦プールの構成比（適合 + 探索 + カバレッジ）

### Decision

推薦セッションの問題数 N（10/20/30）を以下の比率で割り当てる:

| 区分 | 標準比率 | 最低比率 | ソース |
|------|---------|---------|--------|
| Fit Zone 内の苦手・復習 | 50% | — | 移動平均 60–80% セルから `weightedSample` で `weaknessMap` 重みづけ |
| Fit Zone 内の cell-level 未経験市区町村（カバレッジ軸） | 20% | 20% | spec FR-006c |
| Fit Zone 外の探索（未プレイ or 低制覇セル、探索軸） | 30% | 20% | spec FR-006a |

- 比率は標準値であり、Fit Zone のサイズや探索プールの有無に応じて柔軟に調整。
- 不足分は推薦範囲外のランダム補充（FR-013）でカバーし、確認シートで「○問は推薦範囲外」と注記。

### Rationale

- spec FR-006a で「最低 20%」、FR-006c で「最低 20%」を確保すれば、合計最低 40% は探索 + 未経験で固定。残り 60% を Fit Zone 内苦手復習に割り当てる構成が直感的でテストもしやすい。
- `weightedSample`（既存 `lib/quiz/municipality-data.ts`）の苦手重みづけロジックをそのまま流用できる。

### Alternatives considered

- **A: 全部 Fit Zone 内に集める** — 探索・カバレッジを軽視し、長期的に同じ市区町村ばかりになる。spec の多軸モデルに反する。却下。
- **B: 探索・カバレッジを 50% に増やす** — Fit Zone 体験が弱まり、適合軸の意義が薄れる。30% 程度がバランス良い。

## R-005: 推薦履歴キャッシュの実装

### Decision

`localStorage` キー `geodojo:recommendation:history` に以下の JSON を保持する。

```ts
type RecommendationHistoryCache = {
  // 直前セッションで推薦された市区町村コード集合
  lastCodes: string[];
  // ISO 8601 タイムスタンプ
  storedAt: string;
};
```

- 推薦エンジンは前回値を読み取り、新規推薦では `lastCodes` と最低 50% は入れ替わるように `weightedSample` のサンプリングに重みを乗せる（ペナルティ重み: 0.3 倍）。
- `storedAt` から 24 時間経過したら無視（古いセッションを参考にしない）。
- クイズ完了時（`saveMunicipalityQuizResult` の `result` phase）、現在のセッションの市区町村コード集合で `lastCodes` を上書き。

### Rationale

- spec Entities で localStorage、24h 期限を確定済み。
- 再帰呼び出しや SSR 起動時の不整合を避けるため、サーバー側は前回コードを知らない。**クライアントから次回推薦リクエスト時に `excludeCodes` パラメータで渡す** 方式を採用。
- Server Action 経由でクライアント → サーバーへ `excludeCodes` を渡すことで、純粋関数化された推薦エンジンに状態を持たせずに済む。

### Alternatives considered

- **A: サーバー側で DB に直前推薦を保存** — spec の「新テーブル不要」「`localStorage` で対応」アサンプションに反する。却下。
- **B: TanStack Query のキャッシュキーに含めて自然に管理** — `staleTime: 0` で毎回再フェッチするためキャッシュは効かない。明示的な localStorage 管理が必要。

## R-006: 確認シート（ボトムシート）の技術選定

### Decision

shadcn/ui の `Sheet` コンポーネント（Radix UI Dialog ベース）を `side="bottom"` で使用する。

- 既存プロジェクトに未導入なら `pnpm dlx shadcn@latest add sheet` で追加。
- アクセシビリティ（フォーカストラップ、ESC キー閉じ、ARIA 属性）は Radix UI が自動対応。
- アニメーションは Tailwind の `animate-in slide-in-from-bottom` クラスを利用。
- 状態管理は URL クエリ `?recommend=open` で表現し、ブラウザ戻るで閉じられるようにする（モバイル UX 上重要）。

### Rationale

- 既存プロジェクトは shadcn/ui ベース（`components/ui/` 配下に既存コンポーネント多数）で、Sheet を導入しても言語的に違和感がない。
- Radix UI の Dialog 系コンポーネントは A11y 対応が高品質で、自作するより遥かに堅牢。
- URL ステートは spec の「ブラウザ戻るで閉じられる」配慮と整合（モーダル UX のベストプラクティス）。

### Alternatives considered

- **A: 自作のフルスクリーンモーダル** — A11y 実装の手間とバグリスク。却下。
- **B: react-modal-sheet など外部ライブラリ** — 依存追加が増える割に shadcn/ui Sheet で十分。却下。

## R-007: クラウド平均（難易度バケット別全ユーザー正答率）の集計戦略

### Decision

推薦リクエスト時にリアルタイム集計する（キャッシュなし、毎回計算）。

```sql
SELECT
  mm.difficulty,
  COUNT(*) FILTER (WHERE mqr.is_correct) AS correct_count,
  COUNT(*) AS total_count
FROM municipality_quiz_results mqr
INNER JOIN municipality_master mm ON mqr.municipality_code = mm.code
GROUP BY mm.difficulty;
```

- 既存 `mm_difficulty_idx` インデックスを使用。
- 結果は 4 行（easy / medium / hard / expert）。`COUNT FILTER` で集計、`JOIN` は indexed PK lookup。
- 想定パフォーマンス: ms 単位（10 万行程度まで線形に伸びるが、現状の利用規模では 100ms 未満）。

### Rationale

- SC-003（1.5 秒以内）に対し十分な余裕がある。キャッシュは過剰最適化。
- データ整合性（全ユーザーの最新結果が反映される）を保てる。

### Alternatives considered

- **A: 日次バッチで `municipality_master.crowd_accuracy` カラムに事前計算** — spec Backlog B005 と重複。本 spec のスコープ外。
- **B: TanStack Query の長寿命キャッシュ（1 時間）でクライアント側保持** — Server Action の戻り値に同梱すれば自動で同一クエリ内に閉じる。別途キャッシュは不要。

## R-008: 推薦根拠文のテンプレート設計

### Decision

8 カテゴリのテンプレートを `lib/quiz/recommendation/rationale.ts` に定義し、推薦エンジンが各セッションのコンテキスト（Fit Zone 構成・成長軸発火・後退抑制等）に応じて 1 つを選択する。

| Category | テンプレート例 | 発火条件 |
|---|---|---|
| 苦手中心 | `{region}の{difficulty}で苦手な市区町村が{N}件あります` | Fit Zone 内に高 errorRate セルあり |
| 復習タイミング | `最後にプレイから{days}日経った市区町村を復習します` | 探索軸で最終出題 30 日以上経過セルあり |
| 新規探索 | `未挑戦の市区町村{N}件を含みます` | カバレッジ軸が cell 内未経験市区町村を入れた |
| 難易度ステップアップ | `{currentDifficulty}が安定したので、{nextDifficulty}に挑戦しましょう` | 成長軸発火（隣接単方向） |
| モード変更 | `{currentMode}が安定したので、{nextMode}に挑戦しましょう` | 達人天井 + モード変更 |
| 後退抑制 | `少しペースを落として、現在のレベルを確実にしましょう` | 後退抑制発火 |
| 混合（橋渡し） | `現在の{currentDifficulty}復習と、{nextDifficulty}の挑戦を半々で進めます` | 正答率軸と成長軸が衝突（spec Edge Case） |
| コールドスタート | `初めての方向けに{difficulty}を全国から出題します` | 履歴ゼロ or 履歴 < 10 |

優先順位（複数該当時のフォールバック順）:

1. コールドスタート
2. 後退抑制
3. 難易度ステップアップ
4. モード変更
5. 混合（橋渡し）
6. 苦手中心
7. 復習タイミング
8. 新規探索

### Rationale

- spec Assumption で「テンプレート方式」「8 カテゴリ」を確定済み。
- 優先順位を固定にすることで、根拠文がブレない（テスト可能）。

### Alternatives considered

- **A: LLM で動的生成** — spec Assumption で却下済み。
- **B: より細かい分類** — テンプレート数が増えるとメンテ困難。8 カテゴリで十分。

## R-009: 既存資産の再利用

| 既存資産 | 再利用方法 |
|---------|----------|
| `getMunicipalityWeakness()` (`app/(app)/quiz/municipality/actions.ts`) | 推薦エンジン内でユーザーの market 別 errorRate 取得 |
| `weightedSample()` (`lib/quiz/municipality-data.ts`) | Fit Zone 内苦手プールから問題を選定 |
| `filterByRegions` / `filterByDifficulty` / `shuffle` | 推薦セッション構築時の絞り込み |
| `PREFECTURE_TO_REGION` / `REGIONS` / `DIFFICULTIES` / `DIFFICULTY_LABEL` | 推薦根拠文の地方・難易度ラベル表示 |
| `MunicipalityMaster` / `municipalityQuizResults` (Drizzle schema) | データソース |
| `app/(app)/quiz/municipality/[mode]/page.tsx` の `searchParams` ハンドラ | 推薦パラメータ受け渡し用に拡張（`?source=recommend&codes=...`） |
| `components/ui/sheet.tsx`（未導入なら追加） | ボトムシート実装 |
| `components/dashboard/milestone-banner.tsx` 直下の位置 | RecommendHeroCard 挿入位置の参照 |

### Rationale

既存コードの徹底活用により、新規追加コードを最小化し、品質・保守性を高める。spec-002 で確立した `lib/hooks/` パターンも踏襲。

## まとめ

`NEEDS CLARIFICATION` 残課題: ゼロ。
全 9 件の技術調査項目が確定し、Phase 1 設計に進む準備が整った。
