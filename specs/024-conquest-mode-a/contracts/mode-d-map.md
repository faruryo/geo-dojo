# Contract: モード D 地図・正誤・表示

## 正誤

`useMapAction.handleDTap(code, tappedName)`:

- 正解 ⇔ `code === currentQuestion.municipality.code`
- `tappedName` を正誤に使ってはならない
- 正解ハイライトは出題コードのみ。同一 `name`・同一県の他コードをまとめて正解面にしてはならない
- 誤答ハイライトはタップしたコード。出題コードは「正解位置」として示してよい

保存は現行どおり出題の1コード1行。`is_correct` は上記判定。

## 地図ジオメトリ（`MunicipalityMap`）

- 同一 `code` の複数 feature だけ union してよい（離島・飛地）
- `nam_ja` が同じ別コードを1 feature にまとめてはならない
- `idPropertyName` / タップ結果は各コードの領域に対応する

## 回答前表示

- 学習者が出題コードを他コードと区別できるラベルを出す
- 政令市区は市名だけ（札幌市）禁止。`locationLabel(code)`（ビルド時マップ）を使う
- A/B/C の出題文は現行 `name` のまま

## 出題サンプリング

- D の identity は `municipality.code`
- `normalizeMunicipalityName` による市への畳み込みを D のクリア判定・重複排除に使ってはならない
- B/C は 022 の `(name, prefecture)` 集約のまま
