import type { ReactNode } from 'react';
import { Image as ImageIcon } from 'lucide-react';

/**
 * モードプレビューを「触れないサンプル」として包む枠。
 *
 * `ModePreviewA`〜`D` は本番の出題 UI（問題カード・選択肢・地図）と同じ質感で
 * 描いてあり、そのままだと「ここで回答するのか」と誤認される。中身を4つとも
 * 作り替えるのではなく、外側でラベル・破線枠・減光・`pointer-events-none` を
 * 与えて区別する。モードが増えても枠は1つのままで済む。
 */
export function ModePreviewFrame({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="rounded-xl border border-dashed border-muted-foreground/30 bg-muted/10 p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <ImageIcon size={12} className="shrink-0 text-muted-foreground" />
        <span className="text-[11px] text-muted-foreground">プレイ画面イメージ（操作できません）</span>
      </div>
      <div className="pointer-events-none select-none opacity-85">{children}</div>
    </div>
  );
}
