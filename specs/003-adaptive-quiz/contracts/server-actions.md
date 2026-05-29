# Server Actions Contract: おすすめクイズ

**Branch**: `003-adaptive-quiz` | **Date**: 2026-05-28

本フィーチャーで追加する Server Action は 1 つ。既存の `app/(app)/quiz/municipality/actions.ts` に追加する。

## 1. `getRecommendation`

**用途**: ユーザーの学習状態に基づき推薦セット 1 件を返す。CTA タップごとに呼び出され、毎回再計算（キャッシュなし）。

### 入力

```ts
type GetRecommendationInput = {
  // クライアント側 localStorage から渡される、直前セッションの市区町村コード集合
  // 重複ペナルティ算出に使用。空配列でも OK
  excludeCodes?: string[];

  // クライアント側の現在時刻（タイムゾーン推定の補助、任意）。
  // 省略時はサーバー側 Date.now() を使用
  clientNowIso?: string;
};
```

### 出力

```ts
type GetRecommendationOutput = {
  // 推薦パラメータ（spec Key Entities の Recommendation）
  mode: 'A' | 'B' | 'C' | 'D';
  difficulties: ('easy' | 'medium' | 'hard' | 'expert')[];
  regions: ('北海道' | '東北' | '関東' | '中部' | '近畿' | '中国' | '四国' | '九州')[];
  count: 10 | 20 | 30;
  codes: string[];  // 出題対象 municipality_code

  // 推薦根拠
  rationaleCategory:
    | 'cold-start'
    | 'regression'
    | 'difficulty-step-up'
    | 'mode-change'
    | 'bridging'
    | 'weakness-focused'
    | 'review-timing'
    | 'new-exploration';
  rationaleText: string;  // 表示用 1〜2 行テキスト

  // 推薦内部詳細（デバッグ表示・将来テレメトリ用、UI には主に出さない）
  poolBreakdown: {
    fitZoneWeakness: number;
    coverageNew: number;
    exploration: number;
    randomFallback: number;
  };
  flags: {
    isColdStart: boolean;
    isRegressionGuarded: boolean;
    isProgressionFired: boolean;
    isDifficultyCapped: boolean;
  };

  // フォールバック通知（プール不足等）。ない場合は空配列
  notes: string[];
};
```

### エラーハンドリング

- **未認証** (`createServerClient().auth.getUser()` が失敗): `throw new Error('Unauthorized')`。クライアント側 hook がログイン画面へリダイレクト誘導。
- **DB エラー**: 例外をそのまま throw し、TanStack Query の `onError` で処理。クライアント側で「推薦の取得に失敗しました。もう一度お試しください」のトースト表示。
- **推薦不能**: `engine.ts` 内で必ず 1 件以上の Recommendation を返す（spec FR-016 ランダムフォールバック）。例外はスローしない。

### Rate Limit

既存の `app/(app)/quiz/municipality/actions.ts` の rate limiter（60 req/min/user）を流用する。

### 認可

ログイン済みユーザーのみ。`createServerClient().auth.getUser()` で検証。

### 実装の流れ

```ts
'use server';

export async function getRecommendation(
  input: GetRecommendationInput = {}
): Promise<GetRecommendationOutput> {
  // 1. 認証 + rate limit
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  if (!checkRateLimit(user.id)) throw new Error('Rate limit exceeded');

  // 2. 学習状態スナップショット構築（data-model.md § 5）
  const state = await buildLearnerState(user.id);

  // 3. 推薦生成（lib/quiz/recommendation/engine.ts）
  const recommendation = generateRecommendation(state, input.excludeCodes ?? []);

  return recommendation;
}
```

## 既存 Server Actions の流用

本フィーチャーは以下を **変更せずに再利用** する:

| 既存 Action | 用途 |
|------------|------|
| `saveMunicipalityQuizResult` | 推薦経由クイズの結果保存（既存と完全に同一の呼び出し） |
| `getMunicipalityMaster` | クライアント側で `municipality_master` を取得し、推薦結果の `codes` から地図/4 択候補を構築（既存のクイズ実行画面が利用） |
| `getMunicipalityWeakness` | `buildLearnerState` 内で `weaknessByMunicipality` を構築するために流用（同じロジックを再実装しない） |

## URL クエリ契約: 推薦パラメータの引き渡し

ボトムシート「そのまま開始」または「上書きして開始」をタップ時、既存の `/quiz/municipality/[mode]` へ遷移し、推薦パラメータを URL クエリで引き渡す:

```
/quiz/municipality/B?source=recommend
  &difficulty=medium
  &region=東北,関東
  &count=10
  &codes=01100,02201,...    // カンマ区切り municipality_code、最大 30 件
```

- `source=recommend` フラグで、既存クイズ実行画面側で「おすすめ経由」を識別。結果画面の主 CTA を「もう一度おすすめでプレイ」に切り替えるトリガー。
- `codes` クエリが指定されたとき、既存の `buildQuestions()` の前段で「`allMunicipalities.filter(m => codes.includes(m.code))`」をプール化し、`weightedSample` を適用。
- `codes` が空または無効なときは既存のフィルタロジックにフォールバック。

### 受信側の変更（既存 `[mode]/page.tsx`）

1. `searchParams.get('source') === 'recommend'` の判定追加
2. `codes` クエリの解析と filtered pool 構築
3. 結果画面（`phase === 'result'`）に `RecommendReplayButton` を主 CTA として表示

実装変更箇所は約 30 行で収まる見込み。

## まとめ

- 新規 Server Action: `getRecommendation` 1 件のみ
- 既存 Server Actions は変更なし、再利用のみ
- URL クエリで推薦パラメータを既存クイズ実行画面に引き渡す（URL ステート活用）
- 認証・rate limit は既存メカニズムを共有
