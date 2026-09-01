# Data Model: Mode D 市区町村出題選択・絞り込み

## 1. Scope & Settings Model

```typescript
// lib/quiz/municipality-data.ts

export type ScopeType = 'region' | 'prefecture';

export interface MunicipalityScope {
  type: ScopeType;
  regions: Region[];
  prefecture?: string;
  selectedCodes?: string[];
}

export interface MunicipalityQuizSettings {
  mode: GameMode;
  scope: MunicipalityScope;
  count: SessionCount;
  unclearedFirst: boolean;
  weaknessFirst: boolean;
  difficulties: Difficulty[];
}
```

### フィールド定義とバリデーション

| フィールド | 型 | 必須/任意 | 説明 / 制約 |
|---|---|---|---|
| `scope.type` | `'region' \| 'prefecture'` | 必須 | 出題範囲の種別。デフォルトは `'region'`。 |
| `scope.regions` | `Region[]` | 必須 | `type === 'region'` の際に有効。デフォルトは `['全国']`。 |
| `scope.prefecture` | `string` | 任意 | `type === 'prefecture'` の際に有効。`ALL_PREFECTURES` に含まれる県名（例: `'長野県'`）。 |
| `scope.selectedCodes` | `string[]` | 任意 | 個別選択された自治体コードの配列。未指定または空配列の場合は指定都道府県の全自治体。 |

---

## 2. フィルタ関数群のシグネチャ

```typescript
// lib/quiz/municipality-data.ts

/**
 * 出題範囲（地方または都道府県・個別コード）に基づいて市区町村一覧を絞り込む。
 */
export function filterByScope(
  municipalities: Municipality[],
  scope: MunicipalityScope,
): Municipality[] {
  if (scope.type === 'prefecture') {
    if (!scope.prefecture) return municipalities;
    const prefMunicipalities = municipalities.filter((m) => m.prefecture === scope.prefecture);
    if (scope.selectedCodes && scope.selectedCodes.length > 0) {
      const codeSet = new Set(scope.selectedCodes);
      return prefMunicipalities.filter((m) => codeSet.has(m.code));
    }
    return prefMunicipalities;
  }
  return filterByRegions(municipalities, scope.regions);
}
```

---

## 3. UI 状態管理モデル

```typescript
export interface MunicipalitySelectionState {
  isModalOpen: boolean;
  searchQuery: string;
  selectedCodes: Set<string>;
}
```

- **全選択**: 指定都道府県に属する全 `m.code` を `selectedCodes` に追加。
- **全解除**: `selectedCodes` を空 Set にリセット。
- **個別トグル**: 当該 `m.code` の有無を反転。
- **検索フィルタ**: `m.name` または `m.kana` に `searchQuery` を含む自治体を抽出表示。

---

## 4. URL クエリパラメータ相互変換

```typescript
// URL -> Settings
export function parseScopeFromSearchParams(params: URLSearchParams): MunicipalityScope {
  const scopeType = params.get('scope') === 'prefecture' ? 'prefecture' : 'region';
  const pref = params.get('pref') || params.get('prefecture');
  const codesParam = params.get('codes');
  const regionParam = params.get('region');

  if (scopeType === 'prefecture' && pref && ALL_PREFECTURES.includes(pref)) {
    const selectedCodes = codesParam ? codesParam.split(',').filter(Boolean) : undefined;
    return {
      type: 'prefecture',
      regions: ['全国'],
      prefecture: pref,
      selectedCodes,
    };
  }

  const regions = regionParam
    ? (regionParam.split(',').filter((r) => REGIONS.includes(r as Region)) as Region[])
    : ['全国'];

  return {
    type: 'region',
    regions: regions.length > 0 ? regions : ['全国'],
  };
}
```
