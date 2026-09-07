'use client';

import { AlertDialog } from '@base-ui/react/alert-dialog';
import { ChevronLeft } from 'lucide-react';

/**
 * 中断は取り消せない。上端の帯は地図のすぐ上にあり、地図を触る指の動線と近いので、
 * 1タップで発動させず確認を1段挟む。
 *
 * 色は帯と同じく直書きしている。ダイアログは Portal で枠の外へ出るため、
 * テーマ側の配色を拾うと帯と地続きに見えなくなる。
 *
 * 開閉のスタイルは `components/ui/sheet.tsx` に揃えている。Base UI は開閉の途中経過を
 * `data-starting-style` / `data-ending-style` で渡してくる作りで、この repo の既存の
 * Base UI 部品はどれも両方を指定している。
 */
export function AbortConfirm({ onAbort }: Readonly<{ onAbort: () => void }>) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger
        aria-label="クイズを中断する"
        className="inline-flex h-11 min-w-11 items-center gap-0.5 px-2 text-xs text-[#fafafa]"
      >
        <ChevronLeft size={16} aria-hidden />
        中断
      </AlertDialog.Trigger>

      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-black/70 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <AlertDialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[min(20rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-[#111111] p-5 text-[#fafafa] ring-1 ring-white/15 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0">
          <AlertDialog.Title className="text-base font-semibold">
            クイズを中断しますか
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-xs leading-relaxed text-[#fafafa]">
            ここまでの解答は保存されますが、残りの問題は記録されません。
          </AlertDialog.Description>

          <div className="mt-5 flex flex-col gap-2">
            <AlertDialog.Close
              onClick={onAbort}
              className="inline-flex h-11 w-full items-center justify-center rounded-xl text-sm font-medium text-[#fca5a5] ring-1 ring-[#fca5a5]/40"
            >
              中断する
            </AlertDialog.Close>
            <AlertDialog.Close className="inline-flex h-11 w-full items-center justify-center rounded-xl text-sm font-medium text-[#fafafa] ring-1 ring-white/20">
              続ける
            </AlertDialog.Close>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
