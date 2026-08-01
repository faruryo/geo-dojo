---
applyTo: "**/*"
description: "Pull Request (PR) 作成時の手順・チェックリスト・運用ルール"
---

# Pull Request (PR) 作成手順・ルール

本リポジトリで Pull Request を作成・更新する際の標準手順およびチェックリストです。

## 1. 事前検証チェックリスト
PRを作成またはpushする前に、必ず以下のコマンドを実行してすべてパスすることを確認してください。

```bash
npx tsc --noEmit       # 型チェック
pnpm test              # ユニットテスト全件パス
pnpm lint:ratchet      # ESLint ratchet チェック（警告増加がないこと）
```

## 2. コミット＆Staging ルール
- **一括 add の禁止**: `git add .` は使用せず、変更対象のファイルを明示的に個別に指定して `git add <file1> <file2>` してください。
- **コミットメッセージ**: `feat:`, `fix:`, `docs:`, `chore:` などのプレフィックスを付け、変更理由が分かる明確なメッセージを記載してください。

## 3. PR 作成手順
1. ブランチが最新の `main` から分岐していることを確認。
2. 変更内容をリモートブランチへ push。
3. GitHub CLI (`gh pr create`) または Web UI から PR を作成。

## 4. PR 概要テンプレ
```markdown
## 概要
- [変更の背景・目的を記述]

## 変更内容
- [実装した機能や修正内容を箇条書き]

## 検証結果
- [ ] 型チェック (`npx tsc --noEmit`) 通過
- [ ] テスト全件 (`pnpm test`) 通過
- [ ] Lint Ratchet (`pnpm lint:ratchet`) 通過
- [ ] 動作確認済み
