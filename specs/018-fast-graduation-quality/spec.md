# Feature Specification: 解答時間に基づくSM-2評価（q=5）と卒業判定の高速化 (B010 Phase 2/3)

**Feature Branch**: `018-fast-graduation-quality`  
**Created**: 2026-08-15  
**Status**: Draft  
**Input**: User description: "解答時間に基づくSM-2評価（q=5）と卒業判定の高速化を進める（直前の017の続き）"

---

## 1. 背景と動機 (Background & Motivation)

GeoDojo の間隔反復（SRS / SM-2）復習機能では、これまで正解時の評価（ReviewQuality）が `4`（通常正解）固定であり、「即答できるほど完璧に覚えている問題」でも復習間隔の拡大率（Ease Factor）が上がらず、卒業までに一律の回数・日数がかかっていた。

`017-answer-time-recording` で導入された解答時間（`answer_time_ms`）を活用し、以下の2つの改善を行う：
1. **Phase 2（Quality 段階化）**: 10秒以内の速答正解を SM-2 の最高評価 `quality = 5` として扱い、Ease Factor（復習間隔の拡大倍率）を増加させる。
2. **Phase 3（卒業判定の高速化）**: 誤答歴がある問題であっても、速答（`quality = 5`）を重ねて十分に定着している場合は、通常4回の正解を待たず3回目の正解で早期卒業できるようにする。

---

## 2. ユーザーストーリー (User Scenarios & Testing)

### User Story 1 - 速答正解による復習間隔の加速 (Priority: P1)

クイズ（通常クイズ・復習セッション問わず）で市区町村を10秒以内に正解した場合、SM-2 の Ease Factor が上昇し、次回以降の復習間隔が通常よりも速く拡大する。

**Why this priority**: 解答時間データを SRS アルゴリズムに還元する中核機能であり、即座に効果を発揮する。

**Independent Test**:
- 解答時間 10秒以内（<= 10,000ms）で正解した際、`quality = 5` として計算され Ease Factor が `+0.1` 増加することを確認する。
- 解答時間 10秒超（> 10,000ms）または未記録（null）で正解した際、従来の `quality = 4`（Ease Factor 維持）として計算されることを確認する。

**Acceptance Scenarios**:
1. **Given** 復習中の市区町村（EF=2.5, rep=1, interval=1）, **When** 5秒（5,000ms）で正解する, **Then** quality=5 が適用され、EF=2.6, rep=2, interval=6 となる。
2. **Given** 復習中の市区町村（EF=2.6, rep=2, interval=6）, **When** 8秒（8,000ms）で正解する, **Then** quality=5 が適用され、EF=2.7, rep=3, interval=round(6 * 2.7)=16 となる（quality=4 の場合の 15 よりも間隔が広がる）。
3. **Given** 復習中の市区町村, **When** 15秒（15,000ms）で正解する, **Then** quality=4 が適用され、EF は維持される。
4. **Given** 復習中の市区町村, **When** 不正解となる, **Then** 解答時間に関わらず quality=2 が適用され、rep=0, interval=1 にリセットされる。

---

### User Story 2 - 速答の定着による早期卒業 (Priority: P2)

過去に誤答したことがある問題でも、復習で速答（quality=5）を重ねて 3回連続正解（rep>=3 かつ interval>=15）に達した場合、「十分に覚えた」と判定して卒業（`status: 'graduated'`）扱いにする。

**Why this priority**: 一度間違えた問題が「いつまでも復習リストに残り続ける」ストレスを解消し、学習者の達成感と復習負荷の最適化を実現する。

**Independent Test**:
- 誤答歴あり（`everWrong = true`）のアイテムに対し、速答（q=5）で 3回目の正解に達した時、`status` が `graduated` に移行することを確認する。
- 通常正解（q=4）の場合は従来どおり 4回目の正解（rep>=4 かつ interval>=30）まで卒業しないことを確認する。

**Acceptance Scenarios**:
1. **Given** 過去に誤答履歴がある問題（rep=2, interval=6, EF=2.7）, **When** 10秒以内に正解（quality=5）する, **Then** rep=3, interval=16 となり、卒業条件（rep>=3 && quality===5 && interval>=15）を満たして `status: 'graduated'` に移行する。
2. **Given** 過去に誤答履歴がある問題（rep=2, interval=6, EF=2.5）, **When** 15秒で正解（quality=4）する, **Then** rep=3, interval=15 となり、quality=4 のため卒業せず `status: 'reviewing'` のまま次回（4回目）の復習が予定される。
3. **Given** 誤答履歴のない問題（009 仕様）, **When** 2回目の正解に達する, **Then** 解答時間の長短に関わらず `status: 'graduated'` に移行する（既存仕様の完全互換）。

---

## 3. 要求事項 (Requirements)

### 機能要件 (Functional Requirements)

- **FR-001**: システムは解答時間 `answerTimeMs` と正誤 `isCorrect` から SM-2 の `ReviewQuality`（2, 4, 5）を決定する純粋関数（`determineReviewQuality`）を提供しなければならない。
  - `isCorrect === false`: quality = 2
  - `isCorrect === true` かつ `answerTimeMs !== null` かつ `answerTimeMs <= 10,000`（10秒以内）: quality = 5
  - `isCorrect === true` かつ 上記以外（10秒超、または null/undefined）: quality = 4
- **FR-002**: `ReviewQuality` 型定義に `5` を追加し、`applySm2` において quality=5 の計算式が正しく評価されなければならない（EF が +0.1 増加）。
- **FR-003**: `applySm2` または `computeSrsUpdate` は以下の卒業条件を満たした場合に `status: 'graduated'` を返さなければならない。
  1. 誤答歴なし早期卒業（既存）: `!everWrong && isCorrect && repetition >= 2`
  2. 速答による早期卒業（新規）: `isCorrect && quality === 5 && repetition >= 3 && interval >= 15`
  3. 通常卒業（既存）: `repetition >= 4 && interval >= 30`
- **FR-004**: クイズ回答時の SRS 更新処理（`saveMunicipalityQuizResult` -> `upsertSrsRecord` -> `computeSrsUpdate`）において、保存された `answerTimeMs` を `computeSrsUpdate` に引き渡し、quality 判定に反映しなければならない。
- **FR-005**: 既存の同日ガード（同日の正解による前進は1日1回まで）および不正解時のリセット処理はそのまま維持されなければならない。

### エッジケース (Edge Cases)

- 解答時間が計測できなかった（`answerTimeMs === undefined` または `null`）場合: 安全に `quality = 4`（通常正解）として扱う。
- 解答時間が極端に短い（例: 100ms）場合: 10秒以内のため `quality = 5` として扱う。
- 解答時間がちょうど 10,000ms の場合: `quality = 5`（以下判定）。
- 卒業済みのアイテムで再度出題されて不正解となった場合: 従来どおり `status: 'reviewing'`, `repetition: 0`, `interval: 1` にリセットされ、誤答履歴（everWrong）が有効になる。

---

## 4. 成功基準 (Success Criteria)

- **SC-001**: 10秒以内に正解した問題は、Ease Factor が +0.1 増加し、次回以降の間隔拡大が加速する。
- **SC-002**: 誤答歴のある問題でも、速答を重ねることで最短3回の正解（1日目、2日目、8日目）で卒業可能となる（従来は最短22日・4回正解）。
- **SC-003**: 既存の単体テストおよび回帰テストがすべてパスし、SRS 関連の既存仕様（同日ガード、誤答なし早期卒業、不正解リセット）との完全な整合性が保たれる。

---

## 5. 前提条件と非対象 (Assumptions & Out of Scope)

- **速答閾値のモード別個別設定**: 今回は全モード共通で `10秒（10,000ms）` を一律基準とする。将来的にモード別の閾値カスタマイズ要望が出た場合は別途検討する。
- **データベーススキーマ変更**: なし（`answer_time_ms` は 017 で `municipality_quiz_results` に追加済み。`srs_records` のカラム変更も不要）。
