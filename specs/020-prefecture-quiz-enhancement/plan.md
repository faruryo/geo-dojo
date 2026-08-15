# Implementation Plan: 都道府県クイズ強化とタイムアタックモード (B003)

**Branch**: `020-prefecture-quiz-enhancement` | **Date**: 2026-08-15 | **Spec**: [spec.md](file:///Users/faru/geo-dojo/specs/020-prefecture-quiz-enhancement/spec.md)
**Input**: Feature specification from `/specs/020-prefecture-quiz-enhancement/spec.md`

## Summary

都道府県クイズ（`/quiz/prefecture`）に設定画面（地域選択・出題数選択・通常/タイムアタックモード・苦手優先）を導入し、出題生成ロジックおよびタイム計測・自己ベスト保存・結果表示を実装する。

## Technical Context

**Language/Version**: TypeScript 5.x (Strict mode) / React 19  
**Primary Dependencies**: Next.js 15.2.6 (App Router), Tailwind CSS v4, lucide-react  
**Storage**: localStorage（`geodojo-pref-best:*`、`geodojo-pref-weakness`）  
**Testing**: Vitest (`__tests__/lib/quiz/prefecture-quiz.test.ts`)  
**Target Platform**: Web / PWA (Mobile-first, 375px基準, ダークモード `#111111`)  
**Project Type**: Web Application  
**Constraints**: 出題生成・時間フォーマット等の判断ロジックは純粋関数として分離  
**Scale/Scope**: `app/(app)/quiz/prefecture/page.tsx`、`lib/quiz/prefecture-quiz.ts`  

## Constitution Check

- [x] **I. セキュリティ & コンプライアンス**: 外部 API や DB スキーマ変更なし。
- [x] **II. アーキテクチャ & パフォーマンス**: ロジックは pure 関数（`lib/quiz/prefecture-quiz.ts`）に分離。
- [x] **III. ロジック & UI**: 375px モバイルファースト、ダークモード最適化。

## Project Structure

### Documentation (this feature)

```text
specs/020-prefecture-quiz-enhancement/
├── plan.md              # This file
├── research.md          # Phase 0: 設計・方針
├── data-model.md        # Phase 1: 型定義 & インターフェース
├── quickstart.md        # Phase 1: 動作確認手順
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2: タスクリスト
```

### Source Code

```text
lib/quiz/
└── prefecture-quiz.ts               # 新規: 都道府県クイズ純粋関数群（出題生成・時間フォーマット等）

app/(app)/quiz/prefecture/
└── page.tsx                         # 更新: 設定画面・タイマー・タイムアタック・結果画面の統合

__tests__/lib/quiz/
└── prefecture-quiz.test.ts          # 新規: buildPrefectureQuestions, formatClearTime の単体テスト
```

## Complexity Tracking

> Constitution 違反なし。
