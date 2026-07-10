# Contracts: 地域・都道府県絞り込み機能のコンポーネント・URL契約

## 1. URL クエリパラメータ契約

今日のおすすめクイズ（`RecommendContent`）からクイズページ（`/quiz/municipality/[mode]`）へ遷移する際、および通常クイズ画面の共有時に以下のクエリパラメータを引き渡す。

| パラメータ | 役割 | 形式 | 例 |
|---|---|---|---|
| `region` | 選択された地方のフィルタ | カンマ区切りの文字列 | `region=東北,関東` |
| `prefectures` | 選択された都道府県のフィルタ | カンマ区切りの文字列 | `prefectures=宮城県,福島県,東京都` |

### 整合性ルール
- `prefectures` パラメータが渡された場合、`region` パラメータの内容に関わらず、出題プールは `prefectures` に含まれる都道府県のみに制限される。
- クイズ開始時のパースロジックは、無効な都道府県名（`ALL_PREFECTURES` に含まれない値）を無視しなければならない。

---

## 2. UI 状態連携契約 (LocalStorage)

調整ダイアログの表示状態および永続化データは以下の構造に従う。

### キー名: `geodojo-recommend-region-filters`

### 値の定義
```typescript
interface SavedRegionFilters {
  targetRegions: string[];      // 選択された地方名（例: ['東北']）
  targetPrefectures: string[];  // 選択された都道府県名（例: ['宮城県', '福島県']）
}
```

### ライフサイクル仕様
- **マウント時 (Read)**:
  - ローカルストレージから `SavedRegionFilters` を読み取る。
  - 値が存在する場合、`RecommendOverride` コンポーネントおよびクイズ設定の初期状態に適用する。
  - 値が存在しない、あるいは破損している場合は、デフォルト値（`targetRegions = []`, `targetPrefectures = []`）でフォールバックし、全地域を対象とする。
- **変更・開始時 (Write)**:
  - ユーザーが地方/都道府県をトグル選択した際、または「開始」をクリックした際、現在の状態をシリアライズして LocalStorage に保存する。
