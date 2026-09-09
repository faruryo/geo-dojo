'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

const PARAM = 'recommend';
const OPEN = 'open';

export interface RecommendSheetState {
  readonly isOpen: boolean;
  readonly setOpen: (open: boolean) => void;
}

/**
 * 「今日のおすすめクイズ」シートの開閉。
 *
 * 開閉の状態は URL ではなくこの hook が持つ。URL だけを正にすると、タップから
 * `router.push` の RSC 再フェッチが返るまでシートが動かず、数秒のあいだ押せたのか
 * どうか分からない。先に状態を変えて画面を動かし、URL は後から合わせる。
 *
 * URL 同期は捨てない。`/?recommend=open` のリンクで開けること、開いている間に
 * 戻る操作で閉じられることを保つ必要がある。同期には history API を直接使い、
 * ルーターの遷移を挟まない（シートの中身はすべてクライアント側にあり、
 * サーバーから取り直すものが無い）。
 */
export function useRecommendSheet(): RecommendSheetState {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const urlOpen = searchParams.get(PARAM) === OPEN;

  const [isOpen, setIsOpen] = useState(urlOpen);

  // URL 側が変わったときに追従する。他画面からの `/?recommend=open` で開く経路と、
  // 開いている間の戻る操作で閉じる経路の両方がここを通る（history API で書き換えた
  // 履歴を辿り直しても `useSearchParams` は更新されることを実機で確認済み）。
  useEffect(() => {
    setIsOpen(urlOpen);
  }, [urlOpen]);

  const setOpen = useCallback(
    (open: boolean) => {
      setIsOpen(open);

      const params = new URLSearchParams(searchParams.toString());
      if (open) params.set(PARAM, OPEN);
      else params.delete(PARAM);
      const qs = params.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;

      // 開くときは履歴を積み、戻る操作で閉じられるようにする。閉じるときは積まない。
      // 積むと、閉じたあとの戻る操作でまた開いてしまう。
      if (open) window.history.pushState(null, '', url);
      else window.history.replaceState(null, '', url);
    },
    [pathname, searchParams],
  );

  return { isOpen, setOpen };
}
