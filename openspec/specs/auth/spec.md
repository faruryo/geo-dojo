# auth Specification

## Purpose
メールアドレスとパスワードによるサインアップ、ログイン、パスワード再発行と、認証必須画面のガードを定める。あわせて、サーバー側・ブラウザ側で「いま誰か」をどう解決するかと、ユーザーごとの学習データが他人から読み書きされないための不変条件（RLS とアプリ側の user_id 絞り込み）を定める。アプリの DB 接続は RLS を迂回するため、データ分離はアプリ側の絞り込みと RLS の両方で守る。

## Requirements

### Requirement: サインアップ
システムは、メールアドレスとパスワードによるアカウント作成を `/signup` で提供しなければならない (SHALL)。確認メールのリンクは、アクセス元のオリジンの `/auth/callback` に戻らなければならない (MUST)。

#### Scenario: 作成に成功する
- **WHEN** 有効なメールアドレスとパスワードでアカウント作成を送信し、Supabase Auth が成功を返したとき
- **THEN** 画面は「確認メールを送信しました」の案内に切り替わり、入力したメールアドレスと `/login` へのリンクを示す

#### Scenario: 作成に失敗する
- **WHEN** Supabase Auth がエラーを返したとき
- **THEN** そのエラーメッセージをフォーム内に表示し、送信ボタンを再び押せる状態に戻す

#### Scenario: パスワードの最小長
- **WHEN** 8 文字未満のパスワードで送信しようとしたとき
- **THEN** ブラウザのフォーム検証（`minLength=8`）が送信を止める。サーバー側の最小長はアプリのコードでは検証しない

### Requirement: ログイン
システムは、メールアドレスとパスワードによるログインを `/login` で提供しなければならない (SHALL)。失敗の理由（メール未登録かパスワード誤りか）を区別して見せてはならない (MUST NOT)。

#### Scenario: ログインに成功する
- **WHEN** 正しい資格情報でログインしたとき
- **THEN** `/` へ遷移し、サーバーコンポーネントを再取得（refresh）してセッションを画面に反映する

#### Scenario: ログインに失敗する
- **WHEN** Supabase Auth がエラーを返したとき
- **THEN** 原因によらず「メールアドレスまたはパスワードが正しくありません」と表示し、遷移しない

#### Scenario: 他の認証画面への導線
- **WHEN** ログイン画面を開いたとき
- **THEN** `/forgot-password` と `/signup` へのリンクが表示される

### Requirement: パスワード再発行メールの送信
システムは、`/forgot-password` で入力されたメールアドレスにパスワード再設定メールを送らなければならない (SHALL)。メール内リンクは `/auth/callback?next=/reset-password` に戻らなければならない (MUST)。

#### Scenario: 送信に成功する
- **WHEN** メールアドレスを送信し、Supabase Auth が成功を返したとき
- **THEN** 「再発行メールを送信しました」の案内に切り替わり、`/login` へ戻るリンクを示す

#### Scenario: 送信に失敗する
- **WHEN** Supabase Auth がエラーを返したとき
- **THEN** そのエラーメッセージをフォーム内に表示する

### Requirement: パスワードの再設定
システムは、`/reset-password` で新しいパスワードを設定できなければならない (SHALL)。確認入力と一致しない場合は更新を試みてはならない (MUST NOT)。

#### Scenario: 確認入力が一致しない
- **WHEN** 新しいパスワードと確認入力が異なる状態で送信したとき
- **THEN** 「パスワードが一致しません」と表示し、Supabase Auth を呼ばない

#### Scenario: 更新に成功する
- **WHEN** 一致する 8 文字以上のパスワードを送信し、現在のセッションに対する更新が成功したとき
- **THEN** `/quiz` へ遷移し、サーバーコンポーネントを再取得する

#### Scenario: 更新に失敗する
- **WHEN** Supabase Auth がエラーを返したとき（再設定リンク経由のセッションが無い場合を含む）
- **THEN** そのエラーメッセージを表示し、送信ボタンを再び押せる状態に戻す

### Requirement: 認証コールバック
システムは、`/auth/callback` で認可コードをセッションに交換し、`next` が指すアプリ内パスへリダイレクトしなければならない (SHALL)。リダイレクト先はアプリ自身のオリジン内のパスに限らなければならない (MUST)。

#### Scenario: コードをセッションに交換する
- **WHEN** `code` クエリ付きで呼ばれたとき
- **THEN** サーバー側 Supabase クライアントで `exchangeCodeForSession` を実行し、セッションを Cookie に保存する

#### Scenario: next の指定
- **WHEN** `next` が `/` で始まるとき
- **THEN** `<origin><next>` へリダイレクトする（パスワード再発行では `/reset-password`）

#### Scenario: next が未指定または不正
- **WHEN** `next` が無い、または `/` で始まらないとき
- **THEN** `/` へリダイレクトする。外部 URL へは飛ばさない

#### Scenario: code が無い
- **WHEN** `code` クエリが無いとき
- **THEN** 交換を行わず、同じ規則でリダイレクトする

### Requirement: 認証必須画面のガード
システムは、`app/(app)/` 配下のすべての画面（`/`、`/quiz/*`、`/dashboard`、`/analytics` など）を認証必須としなければならない (SHALL)。未認証のアクセスは `/login` へリダイレクトしなければならない (MUST)。ガードは `app/(app)/layout.tsx` のサーバーコンポーネントが毎リクエストで判定し、静的キャッシュしてはならない (MUST NOT)。

#### Scenario: 未認証で認証必須画面を開く
- **WHEN** 有効なセッションの無いリクエストが `app/(app)/` 配下の画面を要求したとき
- **THEN** `/login` へリダイレクトされ、アプリ本体（ボトムナビ、出題画面）は描画されない

#### Scenario: 認証済みで開く
- **WHEN** セッションが有効なとき
- **THEN** 画面は `AppShell`（ボトムナビ、出典フッター）に包まれて表示される

#### Scenario: 認証画面はガードしない
- **WHEN** 認証済みのユーザーが `/login`、`/signup`、`/forgot-password`、`/reset-password` を開いたとき
- **THEN** リダイレクトされず、そのまま表示される（`app/(auth)/` にはガードが無い）

### Requirement: サーバー側のユーザー解決
システムは、サーバー側で現在のユーザー ID を `lib/auth/current-user.ts` の 1 か所で解決しなければならない (SHALL)。ユーザーは Cookie のセッションを Supabase Auth に問い合わせて確定させ（`getUser()`）、JWT の中身を信用して決めてはならない (MUST NOT)。

#### Scenario: 認証済み
- **WHEN** `getCurrentUserId()` を呼んだとき
- **THEN** セッションのユーザー ID を返す

#### Scenario: 未認証
- **WHEN** セッションが無い、または無効なとき
- **THEN** `getCurrentUserId()` は `null` を返し、`requireUserId()` は `Unauthorized` で例外を投げる

#### Scenario: getClaims を使わない
- **WHEN** 認証後の SSR でユーザーを解決するとき
- **THEN** `getClaims()` ではなく `getUser()` を使う。現行の対称鍵（HS256）構成では `getClaims()` が GoTrue のロック競合で SSR を 300 秒ハングさせた。非対称署名鍵を本番で有効にするまで戻さない

### Requirement: Server Action と prefetch の認可
システムは、ユーザーデータを読み書きするすべての Server Action で、最初に `requireUserId()` を呼ばなければならない (SHALL)。対象のユーザー ID はセッションから決め、クライアントから引数で受け取ってはならない (MUST NOT)。SSR のプリフェッチは、未認証なら DB を読まずに空の結果を返さなければならない (MUST)。

#### Scenario: 未認証の Server Action
- **WHEN** 未認証のリクエストがダッシュボード、クイズ結果保存、復習、推薦、マスタ取得の Server Action を呼んだとき
- **THEN** `Unauthorized` で失敗し、DB への読み書きは行われない

#### Scenario: クライアントが他人の ID を指定できない
- **WHEN** クライアントが Server Action を呼ぶとき
- **THEN** 引数に `userId` を持たず、書き込みの `user_id` と読み取りの絞り込みはサーバーが解決した ID だけを使う

#### Scenario: 未認証の SSR プリフェッチ
- **WHEN** ダッシュボードや分析画面のプリフェッチが `getCurrentUserId()` で `null` を得たとき
- **THEN** `null` を返し、クエリを発行しない

### Requirement: ブラウザ側のユーザー ID
システムは、ブラウザ側で現在のユーザー ID が必要なとき `lib/auth/browser-user.ts` の `getBrowserUserId()` を使わなければならない (SHALL)。ログイン状態が変わったとき、ユーザー ID とおすすめのキャッシュを破棄しなければならない (SHALL)。ダッシュボード系など、キーにユーザー ID を含まないほかのキャッシュは破棄しない（現状はアプリ内にログアウト操作がないため、同じタブで別ユーザーに切り替わる経路はない）。

#### Scenario: ID の取得
- **WHEN** `getBrowserUserId()` を呼んだとき
- **THEN** 認証済みなら Supabase Auth に問い合わせたユーザー ID を返し、未ログインなら `null` を返す

#### Scenario: 取得に失敗する
- **WHEN** Supabase Auth への問い合わせがエラーを返したとき
- **THEN** `null` にせず例外を投げる。呼び出し側はこれを再試行可能な失敗として扱う

#### Scenario: ログイン状態の変化
- **WHEN** `SIGNED_IN` または `SIGNED_OUT` を受け取ったとき
- **THEN** TanStack Query の `browserUserId` キャッシュと `recommendation` 配下のキャッシュを破棄する

#### Scenario: おすすめの localStorage
- **WHEN** おすすめの履歴や進行中セッションを localStorage に保存するとき
- **THEN** キーにユーザー ID を含めて、ユーザーごとに分離する（詳細は `recommendation` を参照）

### Requirement: ユーザーデータ表の RLS
システムは、`user_id` を持つ表（現在は `municipality_quiz_results` と `srs_records`）に、Row Level Security の有効化と `auth.uid()` に限定したポリシーを付けなければならない (SHALL)。ポリシーは `FOR ALL`、`USING (user_id = auth.uid())`、`WITH CHECK (user_id = auth.uid())` とし、RLS は Drizzle が生成しないため migration SQL に手で同梱しなければならない (MUST)。

#### Scenario: Data API 経由の他人のデータ
- **WHEN** 認証済みユーザーが Supabase Data API（PostgREST）と publishable key で上記の表を読み書きしたとき
- **THEN** 自分の `user_id` の行だけが見え、他人の行は読めず、変更も削除もできない

#### Scenario: 新しい user_id 付きの表
- **WHEN** `user_id` 列を持つ表を migration で作るとき
- **THEN** `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` を `supabase/migrations/` のいずれかに含める。含まれていなければ `__tests__/server/rls-on-user-tables.test.ts` が CI を落とす

#### Scenario: テストが見ないもの
- **WHEN** 上記のテストが走るとき
- **THEN** RLS の有効化だけを検査し、ポリシーの中身は検査しない。ポリシーの正しさはレビューで確かめる

#### Scenario: 共有マスタ
- **WHEN** `user_id` を持たない共有マスタ（`municipality_master`）を扱うとき
- **THEN** 認証済みユーザーの読み取りだけを許可する。詳細は municipality-master を参照

### Requirement: アプリ側クエリの user_id 絞り込み
システムは、`municipality_quiz_results` と `srs_records` へのすべての読み書きを、解決済みの自分の `user_id` で絞らなければならない (SHALL)。Drizzle は特権ロールで接続して RLS を迂回するため、アプリ側の絞り込みが実質的な防御となる (MUST)。

#### Scenario: 読み取り
- **WHEN** ダッシュボード、分析、復習、推薦、制覇済みコードの取得などがこれらの表を読むとき
- **THEN** 条件に `user_id = <自分>` が入っている

#### Scenario: 書き込み
- **WHEN** クイズ結果と SRS レコードを保存するとき
- **THEN** `user_id` には `requireUserId()` が返した値を入れる。SRS の一意性は `(user_id, municipality_code, mode)` で判定する

#### Scenario: ユーザー横断の集計
- **WHEN** 推薦の学習状態を作る処理が、全ユーザーの回答を難易度ごとに集計するとき
- **THEN** 返すのは難易度別の正解数と回答数の合計だけで、他人の行や ID は呼び出し元に渡さない。個人の行を返す読み取りをユーザー横断にしてはならない

### Requirement: クライアントに出す Supabase 設定
システムは、ブラウザに配る Supabase の設定を `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` に限らなければならない (SHALL)。サーバー専用の値（`DATABASE_URL`、`SUPABASE_SECRET_KEY`）に `NEXT_PUBLIC_` を付けてはならない (MUST NOT)。

#### Scenario: セッション用クライアント
- **WHEN** ブラウザ側とサーバー側（Cookie 経由）の Supabase クライアントを作るとき
- **THEN** どちらも publishable key を使い、ユーザーの権限で動く
