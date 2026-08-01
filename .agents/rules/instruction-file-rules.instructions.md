---
applyTo: "**/*"
description: "AIエージェント用インストラクションファイルの配置・シンボリックリンク運用ルール"
---

# インストラクションファイル運用ルール

本リポジトリでは、各AIツール（Antigravity, Claude Code, Codex, Cursor, Cline）間でインストラクション（開発規約・指示）を統一・共有するために、`.agents/rules/` 配下の `.instructions.md` ファイルを正として管理します。

## 配置構造

1. **ルールの正（SSOT）**: `.agents/rules/*.instructions.md` および `AGENTS.md`
2. **各ツール用シンボリックリンク**:
   - **Antigravity / エージェント共通**: `AGENTS.md`
   - **Claude Code**: `CLAUDE.md` -> `AGENTS.md`
   - **Codex**: `CODEX.md` -> `AGENTS.md`, `.codexrules` -> `AGENTS.md`
   - **Cursor**: `.cursorrules` -> `.agents/rules/db-schema.instructions.md`
   - **Cline**: `.clinerules` -> `.agents/rules/db-schema.instructions.md`

## 運用ルール
- 新しい共通ルールを追加する際は `.agents/rules/` 配下に `<topic>.instructions.md` として作成する。
- 各ツールが自動読み込みするルートの各種設定ファイルは、`.agents/rules/` または `AGENTS.md` への相対シンボリックリンクで維持する。
