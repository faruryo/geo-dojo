import type { ReactNode } from 'react';
import { Image as ImageIcon } from 'lucide-react';

/**
 * モードプレビューを「触れないサンプル」として包む枠。
 *
 * `ModePreviewA`〜`D` は本番の出題 UI（問題カード・選択肢・地図）と同じ質感で
 * 描いてあり、そのままだと「ここで回答するのか」と誤認される。中身を4つとも
 * 作り替えるのではなく、外側でラベル・破線枠・減光を与えて区別する。
 * モードが増えても枠は1つのままで済む。
 *
 * 中身は `inert` にする。`pointer-events-none` はポインタを止めるだけで、
 * 地図（`MiniJapanMap`）の各都道府県は react-simple-maps が `tabIndex={0}` を
 * 固定で付けるうえ `outline: none` なので、キーボードだとフォーカス位置が
 * 見えないタブストップが 47 個並ぶ。ラベルは枠の外に置いて読み上げに残す。
 */
export function ModePreviewFrame({
  caption,
  children,
}: Readonly<{ caption: string; children: ReactNode }>) {
  return (
    <div className="rounded-xl border border-dashed border-muted-foreground/30 bg-muted/10 p-3">
      <div className="mb-2">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ImageIcon size={12} className="shrink-0" />
          プレイ画面イメージ（操作できません）
        </p>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{caption}</p>
      </div>
      <div inert className="pointer-events-none select-none opacity-85">
        {children}
      </div>
    </div>
  );
}
