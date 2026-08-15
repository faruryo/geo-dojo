# Feature Specification: 解答時間の計測と DB 保存処理の実装 (B010 Phase 1)

**Feature ID**: `017-answer-time-recording`  
**Backlog Reference**: `B010`  
**Created**: 2026-08-12  
**Status**: Implemented  

---

## 1. 概要 (Overview)

GeoDojo のクイズ機能（Mode A/B/C/D）において、各問題が出題表示されてからユーザーが解答を確定（またはタイムアウト）するまでの経過時間をミリ秒単位（`answerTimeMs`）で計測し、データベース（`municipality_quiz_results`）へ保存する。

本仕様はバックログ B010（解答時間の記録と習熟判定の高速化）の Phase 1 であり、今後の習熟度判定アルゴリズム（Anki/SM-2 の quality 動的評価）や高速卒業判定の基盤データを提供する。

---

## 2. ユーザーストーリー (User Stories)

### User Story 1: クイズ問題の解答所要時間の計測と保存 (Priority: P1)
- **As a** クイズプレイヤー
- **I want** クイズの解答に要した時間（ミリ秒）が各問題の回答履歴として保存される
- **So that** どの問題にどれくらい時間がかかったか、また将来の習熟度判定に役立てることができる

### User Story 2: 不正な解答時間値のバリデーションと安全なフォールバック (Priority: P1)
- **As a** システム
- **I want** ブラウザ放置などで発生する極端に巨大な値（PostgreSQL integer 上限超え）や不正な値が送信された際に安全に `null` に丸められる
- **So that** データベース保存エラーや SRS 更新の失敗を防ぐことができる

---

## 3. 要求事項 (Requirements)

### 機能要件 (Functional Requirements)

- **FR-001**: システムは出題表示時から解答確定時までの経過時間（ミリ秒）を各問題で正確に計測しなければならない。
- **FR-002**: `municipality_quiz_results` テーブルに `answer_time_ms` (integer, NULL許容) カラムを拡張し、計測された解答時間を保存しなければならない。
- **FR-003**: 解答時間 `answerTimeMs` は 0 以上 `2,147,483,647` (PostgreSQL signed 32-bit integer 上限) 以下の範囲でバリデーションし、四捨五入して保存しなければならない。
- **FR-004**: 範囲外の数値や不正な入力値は DB 保存エラーを防ぐため `null` にフォールバックしなければならない。
- **FR-005**: データベース仕様書 (`docs/db-schema.md`) に新カラム `answer_time_ms` の定義を反映しなければならない。
