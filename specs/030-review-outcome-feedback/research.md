# Research: 復習完了時のSRS進捗・定着可視化

## R1. 回答後の状態はクライアント計算か DB 再取得か

- **Decision**: 保存成功した行について、完了後に DB から再取得する（`getSrsSnapshot`）。
- **Rationale**: SRS の更新はサーバ側の `now`、トランザクション内の誤答歴照会、同日ガードに依存する。クライアントで `computeSrsUpdate` を再実行すると時刻のずれや別タブでの更新で結果が食い違い、誤った「卒業」を出しうる。DB の値を正とすれば SC-001 を構造的に満たせる。
- **Alternatives considered**: 保存 Server Action の戻り値に回答後状態を含める案。`saveMunicipalityQuizResults` は通常クイズとも共有しており、戻り値の契約変更は影響範囲が広い。再取得は1バッチ1回で済むため、こちらを採用した。

## R2. 回答前スナップショットの取得タイミング

- **Decision**: `buildReviewQuestions` の後、`setPhase('playing')` の前に await する。
- **Rationale**: 出題開始後に取得すると、1問目の保存が先に完了して回答後の値を回答前として読むレースが起こる。出題前に取ればこの可能性は消える。
- **Alternatives considered**: `getDueReviewItems` の戻り値に SRS 状態を含める案。Mode A の同名別県（due ではない代表コード）はそこに含まれないため、出題確定後のキー集合で別途取得する必要がある。

## R3. 「あと○回」の前提となる回答速度

- **Decision**: quality=4（通常速度）を前提にシミュレーションし、文言に「通常の速さなら」を付ける。
- **Rationale**: q=4 では EF が変わらないため、結果が決定的で説明しやすい。速答（q=5）を前提にすると最短回数になり、実際より楽観的な目安になる。
- **Alternatives considered**: 速答と通常の両方を表示する案。375px で1行に収まらず情報過多になるため不採用。

## R4. 同日ガードの検出方法

- **Decision**: 正解 かつ 回答前のレコードがあり、回答前後で `last_reviewed_at` が同一であれば「同日回答済み」とする。
- **Rationale**: `computeSrsUpdate` の skip は upsert を行わないため、`last_reviewed_at` が変わらない。更新されれば必ずサーバの `now` に変わるので、等値比較で判別できる。

## R5. 保存成否と問題の対応付け

- **Decision**: `recordAndAdvance` で `QuestionSaveMeta { questionIndex: state.qIdx, persisted, mode, isCorrect, codes }` を生成し、ref に蓄積して `onComplete` の第2引数で渡す。受け取り側では件数・番号の範囲と重複・コード集合の一致を検証し、1つでも不一致ならバッチ全体をフォールバックにする。
- **Rationale**: 表示用の `results` は1問1件に正規化済みで、コード情報を持たない。保存単位のコードは `entries` にしかないので、生成元で記録するのが確実。部分的に表示すると不整合の検出が難しくなるため、全体フォールバックにする。

## R6. 件数上限

- **Decision**: 1回あたり最大100キー。クライアントは超過時に取得せずフォールバックにする。
- **Rationale**: 20問 × 最大4県 = 80 で通常は収まる。サーバ側の上限は、悪意ある大量照会への防御として設ける。
