# Contract: おすすめ抽選

公開 HTTP API は追加しない。既存 `getRecommendation`（`app/(app)/quiz/municipality/actions.ts`）と純粋関数 `generateRecommendation` の契約を置き換える。

## `getRecommendation(input)`

追加入力（クライアント、localStorage 由来。改ざんされても学習UXのみ）:

```ts
type LastModeSession = {
  sessionId: string;
  mode: 'A' | 'B' | 'C' | 'D';
  accuracy: number; // 0..1, 表示1問正規化
  questionCount: number; // >= 1
  region: string;
  difficulty: string;
};

type RecommendClientState = {
  lastA: LastModeSession | null;
  lastByMode: Partial<Record<'B' | 'C', LastModeSession>>;
  swapConsumedForASessionId: string | null;
};
```

- `lastA === null` → FR-013。B/C 差し替え禁止。
- `questionCount === 0` のオブジェクトは送ってはならない。

出力: 既存 `Recommendation`。`mode` は A/B/C/D。苦戦前かつ最小マス規則前の初手モード分布は A/D が各々およそ 40–60%（SC-004）。

## 純粋関数（テスト契約）

乱数 `random: () => number` を引数に取る。ケース表で固定列を与える。

| ケース | 期待 |
|--------|------|
| 全市に 90% 未満マスあり、苦戦なし | 初手モードは A または D。B/C にならない |
| A かつ地方=北海道が候補 | 候補に入らない |
| 関東 A 入門 90%・中級 50% | 関東×A が選ばれれば中級 |
| ある地方がそのモードで全市 90% | その地方は引き直し |
| 抽選対象全市 90%+ | 最小マスで mode・地方・難易度を一括決定。最易難易度ステップは走らない。同率は random |
| 全マス 100% | 開始できるマスから均等 |
| A 引き・lastA.accuracy < 0.3・未差し替え・B/C 両方なし | B または C。D ではない。地方・難易度は A 抽選のまま |
| 同マスの直近 B/C がどちらも >= 0.3 | A のまま |
| 直近 B のみ < 0.3 | B のみ |
| 同じ lastA.sessionId で swap 済み | A のまま |
| D 引き・lastA が低くても | D のまま |
| lastA なし | 差し替えなし |
| Mode A 同名2県が1問 | accuracy 分母は1 |

出題 `codes` は除外履歴用。未クリア優先のサンプリングはクイズページ側（022）の契約を維持する。D の未クリアはコード単位。

## キャッシュ

- キー: `queryKeys.recommendation()`
- 1問以上保存してセッション退出したあと、表示前に stale な推薦を出してはならない
- 未プレイ再訪の二重フェッチ抑制は維持してよい
