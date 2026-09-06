export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { getCurrentUserId } from '@/lib/auth/current-user';
import { AppShell } from './app-shell';

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // getClaims 優先（非対称鍵ならローカル検証で往復ゼロ、未対応時は getUser フォールバック）
  const userId = await getCurrentUserId();

  if (!userId) {
    redirect('/login');
  }

  // 枠（出典 footer・ボトムナビ・下余白）の出し分けは AppShell が持つ。
  // 認証のためこの層は server component のまま据え置く。
  return <AppShell>{children}</AppShell>;
}
