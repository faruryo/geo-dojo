# Data Model: 誤答なし市区町村の早期卒業

**スキーマ変更なし。** 既存テーブルの読み取り・状態遷移の変更のみ。

## 既存エンティティ（参照）

### srs_records（変更なし・状態遷移のみ拡張）

| フィールド | 用途（本機能での関わり） |
|-----------|------------------------|
| user_id, municipality_code, mode | 学習状態の単位（unique: `srs_user_code_mode_uidx`） |
| repetition | 連続正解回数。早期卒業条件の一部（>= 2） |
| status | `reviewing` / `graduated`。本機能が遷移条件を追加 |
| ease_factor, interval, due_date, last_reviewed_at | SM-2 計算値。早期卒業でも加工しない |

### municipality_quiz_results（変更なし・読み取りのみ）

| フィールド | 用途 |
|-----------|------|
| user_id, municipality_code, mode | everWrong 判定のキー |
| is_correct | `false` 行の存在 = 誤答あり |

インデックス: `mqr_user_code_idx` (user_id, municipality_code) — EXISTS 照会で使用。

## 導出値

### everWrong: boolean

```
everWrong(userId, code, mode) ⟺
  EXISTS (SELECT 1 FROM municipality_quiz_results
          WHERE user_id = userId AND municipality_code = code
            AND mode = mode AND is_correct = false)
```

- 全期間の履歴が対象（005 導入前の回答も含む）
- 正解時のみ照会する（不正解経路では未使用）
- 照会タイミング: 当該回答の results INSERT 後だが、正解行は `is_correct = false` に該当しないため結果に影響しない

## 状態遷移（変更点）

```
reviewing --(正解, SM-2)--> reviewing
reviewing --(正解, interval>=30 && rep>=4)--> graduated          # 既存
reviewing --(正解, !everWrong && 新rep>=2)--> graduated          # ★新規（早期卒業）
graduated --(誤答)--> reviewing（rep=0, interval=1 リセット）      # 既存・不変
```

早期卒業後に誤答すると `reviewing` に復帰し、以後は誤答履歴が存在するため everWrong=true → 通常コースのみ。

## バックフィル対象の述語

```
status = 'reviewing' AND repetition >= 2 AND NOT everWrong
→ status = 'graduated' に UPDATE（他フィールドは不変）
```

冪等: 対象条件に `status='reviewing'` を含むため、再実行時は既卒業行が対象外。
