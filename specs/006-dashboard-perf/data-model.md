# Data Model: ダッシュボード表示速度の改善

**結論: スキーマ変更なし。**

本件はパフォーマンス改修であり、新規テーブル・カラム・インデックスの追加や変更を伴わない。

## 関与する既存テーブル（読み取りのみ）

| テーブル | 用途 | 既存インデックス（維持） |
|---------|------|------------------------|
| `municipality_quiz_results` | 回答ログ集計（正答率・カバレッジ・苦手・ストリーク） | `mqr_user_code_idx(user_id, municipality_code)`, `mqr_user_time_idx(user_id, answered_at)` |
| `municipality_master` | 母数・難易度・地域（約1900行） | `mm_difficulty_idx`, `mm_region_diff_idx` |
| `srs_records` | 復習サマリ・予定・モード別内訳 | `srs_user_due_idx(user_id, due_date)`（憲法 II で維持必須） |

## リファクタの不変条件

- read クエリを `userId` 引数の純粋関数化（`dashboard/queries.ts`）しても、**発行される SQL・集計ロジック・返却 shape は現状と同一**に保つ（AC4: 数値一致）。
- 既存の `serialize`（Date/bigint 正規化）挙動を維持する。
