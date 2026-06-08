export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { getCurrentUserId } from '@/lib/auth/current-user';
import BottomNav from './bottom-nav';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // getClaims 優先（非対称鍵ならローカル検証で往復ゼロ、未対応時は getUser フォールバック）
  const userId = await getCurrentUserId();

  if (!userId) {
    redirect('/login');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      <main style={{ flex: 1, overflowY: 'auto', paddingBottom: '6rem' }}>
        {children}
        <footer className="text-center text-[10px] text-zinc-600 mt-8 px-2 space-y-0.5">
          <p>「国土数値情報（行政区域データ）」（国土交通省）をもとに GeoDojo が加工して作成</p>
          <p>「国勢調査」（総務省統計局, e-Stat）データを利用</p>
          <p>このサービスは、政府統計総合窓口(e-Stat)のAPI機能を使用していますが、サービスの内容は国によって保証されたものではありません。</p>
        </footer>
      </main>
      <BottomNav />
    </div>
  );
}
