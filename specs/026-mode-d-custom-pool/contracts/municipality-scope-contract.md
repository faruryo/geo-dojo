# Contract: Municipality Scope & Selection Interface

## 1. Scope Filter Contract

```typescript
export interface MunicipalityScope {
  type: 'region' | 'prefecture';
  regions: Region[];
  prefecture?: string;
  selectedCodes?: string[];
}
```

### Invariants & Rules:
1. **Region Mode**:
   - `type === 'region'`
   - `regions` contains at least one valid `Region` (defaults to `['全国']`).
   - If `regions` contains `'全国'`, it matches all 47 prefectures.
2. **Prefecture Mode**:
   - `type === 'prefecture'`
   - `prefecture` must be a valid prefecture name in `ALL_PREFECTURES` (e.g. `'長野県'`).
   - `selectedCodes` (if specified) contains valid JIS municipality codes that belong to the specified `prefecture`.
   - If `selectedCodes` is empty or undefined, all municipalities in the specified prefecture are included in the pool.
3. **Availability**:
   - For Mode D, single prefecture selection is always available (`isScopeAvailable('D', scope)` returns `true`).
   - For Mode A / Mode B, at least 2 prefectures are required across the scope.
4. **Pool Size & Fallback**:
   - When the filtered pool size is positive but smaller than the session question count (e.g., 5 municipalities selected for a 10-question quiz), the question generator will sample with repetition/shuffling from the selected pool.

---

## 2. URL Parameters Contract

| Param | Format | Example | Description |
|---|---|---|---|
| `scope` | `'region' \| 'prefecture'` | `scope=prefecture` | 出題スコープ種別 |
| `pref` | string | `pref=長野県` | 都道府県名（`scope=prefecture` 時） |
| `codes` | comma-separated strings | `codes=20201,20202` | 個別選択された自治体コード |
| `region` | comma-separated strings | `region=関東,中部` | 地方名（`scope=region` 時） |
| `difficulties` | comma-separated strings | `difficulties=easy,medium` | 難易度フィルタ |
| `count` | number (`10 \| 20 \| 30`) | `count=10` | 問題数 |

