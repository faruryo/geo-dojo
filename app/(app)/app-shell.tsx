'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import BottomNav from './bottom-nav';

/**
 * 出題中だけアプリ共通の枠（出典 footer・ボトムナビ・下余白）を外すための土台。
 *
 * `app/(app)/layout.tsx` は認証のために server component のままにしたいので、
 * client 境界をここで1枚下げ、boolean 1つの Context で出し分ける。
 */

interface ImmersiveContextValue {
  readonly setImmersive: (active: boolean) => void;
}

const ImmersiveContext = createContext<ImmersiveContextValue | null>(null);

/**
 * マウント中だけフルスクリーン枠を要求する。
 *
 * cleanup で必ず false に戻すため、中断・完了・エラー境界のどの経路で抜けても
 * 通常レイアウトへ復帰する。同時に true を要求する呼び出し元は1つだけ。
 */
export function useImmersiveLayout(active: boolean): void {
  const ctx = useContext(ImmersiveContext);

  useEffect(() => {
    if (!ctx) return;
    ctx.setImmersive(active);
    return () => ctx.setImmersive(false);
  }, [ctx, active]);
}

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const [immersive, setImmersive] = useState(false);

  // setImmersive は state setter なので参照が安定している。Context の値ごと
  // 固定しておかないと、再描画のたびに useImmersiveLayout の effect が動く。
  const value = useMemo<ImmersiveContextValue>(() => ({ setImmersive }), []);

  return (
    <ImmersiveContext.Provider value={value}>
      <div className="flex h-[100dvh] flex-col">
        <main
          className={cn(
            'flex-1',
            // 帯と地図で 100dvh を割り付けたとき、端数でスクロールが出ると
            // 操作対象が画面外へ逃げる。出題中は overflow を殺す。
            immersive ? 'overflow-hidden' : 'overflow-y-auto pb-24',
          )}
        >
          {children}
          {!immersive && (
            <footer className="text-center text-[10px] text-zinc-600 mt-8 px-2 space-y-0.5">
              <p>「国土数値情報（行政区域データ）」（国土交通省）をもとに GeoDojo が加工して作成</p>
              <p>「国勢調査」（総務省統計局, e-Stat）データを利用</p>
              <p>このサービスは、政府統計総合窓口(e-Stat)のAPI機能を使用していますが、サービスの内容は国によって保証されたものではありません。</p>
            </footer>
          )}
        </main>
        {!immersive && <BottomNav />}
      </div>
    </ImmersiveContext.Provider>
  );
}
