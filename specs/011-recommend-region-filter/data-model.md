# Data Model: 今日のおすすめクイズにおける地域選択（絞り込み）機能の改善

本機能では、データベーススキーマの変更は行わない。
クライアントサイドで保持およびシリアライズする設定データ構造と、LocalStorage での保存形式について定義する。

## データ構造 (Entities)

### 1. クイズ設定拡張 (Settings)
クイズプレイ画面（`page.tsx`）および調整ダイアログで保持する設定情報。既存の構造に `prefectures` を追加する。

```typescript
interface Settings {
  mode: GameMode;
  regions: Region[];
  prefectures: string[]; // [新規追加] 絞り込み対象の都道府県名リスト（例: ['宮城県', '福島県']）
  count: SessionCount;
  weaknessFirst: boolean;
  difficulties: Difficulty[];
}
```

### 2. 調整ダイアログのオーバーライド状態 (Overrides)
`RecommendOverride` コンポーネントが親コンポーネントへ引き渡す状態データ。

```typescript
export type Overrides = {
  mode: GameMode;
  count: 10 | 20 | 30;
  targetRegions: string[];      // [変更] ポジティブ選択された地方リスト（例: ['東北', '関東']）
  targetPrefectures: string[];  // [新規追加] ポジティブ選択された都道府県リスト
};
```

---

## シリアライズ形式

### 1. URL クエリパラメータ
今日のおすすめクイズの開始ボタン押下時に遷移する URL のクエリパラメータ。

- **`region`**: 選択された地方のカンマ区切り（例: `region=東北,関東`）
  - 都道府県での絞り込みが有効な場合、`region` は省略（または空）にするか、あるいは選択された都道府県に対応する地方をすべて含める（クイズページ遷移時のデフォルト設定復元のため、両方含めるのが望ましい）。
- **`prefectures`**: 選択された都道府県のカンマ区切り（例: `prefectures=宮城県,福島県,東京都`）

#### パース・適用ロジック
- クイズプレイ画面（`page.tsx`）でのパース優先度：
  1. `prefectures` クエリパラメータが存在する場合：
     - `Settings.prefectures` に都道府県リストを設定。
     - `Settings.regions` は、それらの都道府県が属する地方（`PREFECTURE_TO_REGION` から導出）のユニークリストを設定。
  2. `prefectures` がなく `region` が存在する場合：
     - `Settings.regions` に地方リストを設定。
     - `Settings.prefectures` は空配列を設定（その地方の全市区町村が対象）。

### 2. LocalStorage 保存形式
ユーザーが選択した絞り込み条件の永続化形式。

- **キー名**: `geodojo-recommend-region-filters`
- **保存データ構造 (JSON)**:
  ```json
  {
    "targetRegions": ["東北"],
    "targetPrefectures": ["宮城県", "福島県"]
  }
  ```
- **ライフサイクル**:
  - クイズ開始時（`handleStart`）、または調整ダイアログ内での設定更新時に即座に保存。
  - ダイアログマウント時に値をロードし、存在すれば `overrides` の初期値として適用する。
