'use client';

import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`;
    const { error } = await getSupabase().auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setDone(true);
    setLoading(false);
  }

  if (done) {
    return (
      <div className="flex items-center justify-center min-h-dvh p-4">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-6 text-center flex flex-col gap-3">
            <p className="text-lg font-semibold">再発行メールを送信しました</p>
            <p className="text-sm text-muted-foreground">
              {email} に届いたリンクをクリックして新しいパスワードを設定してください。
            </p>
            <a href="/login" className="text-primary underline text-sm">ログインへ戻る</a>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-dvh p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl text-center">GeoDojo</CardTitle>
          <p className="text-muted-foreground text-center text-sm">パスワードを再発行</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRequest} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" htmlFor="email">メールアドレス</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 rounded-md border border-input bg-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                placeholder="you@example.com"
              />
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? '送信中...' : '再発行メールを送信'}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              <a href="/login" className="text-primary underline">ログインへ戻る</a>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
