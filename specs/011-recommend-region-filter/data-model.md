# データモデル: 今日のおすすめクイズにおける地域選択（絞り込み）機能の改善

本機能では、データベーススキーマの変更は行いません。  
クライアントサイドで保持およびシリアライズする設定データ構造と、LocalStorage での保存形式について定義します。

---

## データ構造 (Entities)

### 1. クイズ設定 (Settings)
クイズプレイ画面（`page.tsx`）および調整ダイアログで保持する設定情報。地方（`regions`）の指定は配列として保持します。

```typescript
interface Settings {
  mode: GameMode;
  regions: Region[]; // 絞り込み対象の地方リスト（例: ['東北', '関東']、空配列または['全国']の場合はフィルタなし）
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
  targetRegions: string[]; // ポジティブ選択された地方リスト（例: ['東北', '関東']、空の場合は全国）
};
```

---

## シリアライズ形式

### 1. URL クエリパラメータ
今日のおすすめクイズの開始ボタン押下時に遷移する URL のクエリパラメータ。

- **`region`**: 選択された地方のカンマ区切り（例: `region=東北,関東`）

#### パース・適用ロジック
- クイズプレイ画面（`page.tsx`）でのパース：
  - `region` クエリパラメータが存在する場合、カンマ区切りでパースし `Settings.regions` に適用します。指定がない場合はデフォルトとして `['全国']` を設定します。

### 2. LocalStorage 保存形式
ユーザーが選択した絞り込み条件の永続化形式。

- **キー名**: `geodojo-recommend-region-filters`
- **保存データ構造 (JSON)**:
  ```json
  {
    "targetRegions": ["東北"]
  }
  ```
- **ライフサイクル**:
  - クイズ開始時（`handleStart`）、または調整ダイアログ内での設定更新時に即座に保存。
  - ダイアログマウント時に値をロードし、存在すれば `overrides` の初期値として適用します（ロード時はエラー安全のため `try-catch` で保護し、空の場合は `initial.regions` にフォールバックします）。
