# Implementation Plan: 解答時間に基づくSM-2評価（q=5）と卒業判定の高速化 (B010 Phase 2/3)

**Branch**: `018-fast-graduation-quality` | **Date**: 2026-08-15 | **Spec**: [spec.md](file:///Users/faru/geo-dojo/specs/018-fast-graduation-quality/spec.md)
**Input**: Feature specification from `/specs/018-fast-graduation-quality/spec.md`

## Summary

`017-answer-time-recording` で保存された解答時間（`answer_time_ms`）に基づき、SM-2 アルゴリズムの ReviewQuality を段階化（速答正解は q=5、通常正解は q=4、不正解は q=2）して Ease Factor を加速させる。さらに、誤答歴がある問題でも速答（q=5）を重ねて rep=3 に達した場合は早期卒業（`status: 'graduated'`）できるようにし、覚えた問題の復習滞留を解消する。

## Technical Context

**Language/Version**: TypeScript 5.x (Strict mode) / Node.js 25  
**Primary Dependencies**: Next.js 15.2.6 (App Router / React 19), Drizzle ORM, Vitest  
**Storage**: Supabase (PostgreSQL) — スキーマ変更なし（既存の `municipality_quiz_results.answer_time_ms` を利用）  
**Testing**: Vitest (`__tests__/lib/quiz/srs/` 配下の単体テスト)  
**Target Platform**: Web / PWA (Mobile-first, 375px)  
**Project Type**: Web Application  
**Performance Goals**: SRS 計算処理はすべて純粋関数で即時実行（<1ms）  
**Constraints**: 判断と I/O の分離、同日ガード・既存卒業仕様（009）との完全な後方互換性  
**Scale/Scope**: `lib/quiz/srs/` 配下のロジック拡張および Server Action（`app/(app)/quiz/municipality/actions.ts`）への引数伝搬  

## Constitution Check

- [x] **I. セキュリティ & コンプライアンス**: API キー・認証関連の変更なし。Server Action での認証チェック・バリデーションは既存コードを踏襲。
- [x] **II. アーキテクチャ & パフォーマンス**: ロジックはすべて pure 関数（`lib/quiz/srs/`）として実装し、DB アクセス・Server Action 境界と明確に分離。
- [x] **III. ロジック & UI**: 既存の復習・ダッシュボード表示との互換性を維持。

## Project Structure

### Documentation (this feature)

```text
specs/018-fast-graduation-quality/
├── plan.md              # This file
├── research.md          # Phase 0: 意思決定・計算式・閾値の根拠
├── data-model.md        # Phase 1: 型定義
├── quickstart.md        # Phase 1: 検証手順
├── contracts/           # Phase 1: インターフェース定義
│   └── srs-functions.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2: タスクリスト
```

### Source Code

```text
lib/quiz/srs/
├── types.ts             # ReviewQuality (2 | 4 | 5)
├── quality.ts           # 新規: determineReviewQuality (速答判定 pure 関数)
├── sm2.ts               # applySm2 (q=5 対応 & 早期卒業判定拡張)
├── update.ts            # computeSrsUpdate (answerTimeMs 引数追加 & quality 連携)
└── scheduler.ts         # 既存: 同日判定

app/(app)/quiz/municipality/
└── actions.ts           # saveMunicipalityQuizResult / upsertSrsRecord で answerTimeMs を computeSrsUpdate へ渡す

__tests__/lib/quiz/srs/
├── quality.test.ts      # 新規: determineReviewQuality の単体テスト
├── sm2.test.ts          # applySm2 の q=5 および卒業判定テスト
└── update.test.ts       # computeSrsUpdate の answerTimeMs 連携テスト
```

## Complexity Tracking

> Constitution 違反なし。不要な複雑性は追加しない。
