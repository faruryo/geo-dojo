'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, MapPin, List } from 'lucide-react';
import { Button } from '@/components/ui/button';

const MiniJapanMap = dynamic(
  () => import('@/components/map/MiniJapanMap').then((m) => m.MiniJapanMap),
  { ssr: false, loading: () => <div className="w-full h-full bg-muted/30 rounded-xl animate-pulse" /> },
);

type Mode = 'A' | 'B' | 'C' | 'D';

interface ModeInfo {
  key: Mode;
  shortLabel: string;
  longLabel: string;
  description: string;
  // Lucide icon component
  Icon: typeof MapPin;
}

const MODES: ModeInfo[] = [
  {
    key: 'A',
    shortLabel: 'モードA',
    longLabel: '逆引き地図',
    description: '市区町村名から「どの都道府県にあるか」を日本地図で答える。同名の市区町村は複数県をすべて選ぶ。',
    Icon: MapPin,
  },
  {
    key: 'B',
    shortLabel: 'モードB',
    longLabel: '逆引き4択',
    description: '市区町村名から「どの都道府県にあるか」を4択で答える。地図が苦手な人向け。',
    Icon: List,
  },
  {
    key: 'C',
    shortLabel: 'モードC',
    longLabel: '順引き4択',
    description: '都道府県名から「どの市区町村があるか」を4択で答える。市区町村名を覚えるのに最適。',
    Icon: List,
  },
  {
    key: 'D',
    shortLabel: 'モードD',
    longLabel: '順引き地図',
    description: '都道府県内の市区町村を地図でタップして答える。30秒以内、不正解は同じ問題で再挑戦。',
    Icon: MapPin,
  },
];

// ─── Mini preview UIs (dummy data) ─────────────────────────────────

function ModePreviewA() {
  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-xl bg-card border p-3 text-center">
        <p className="text-xs text-muted-foreground mb-1">この市区町村がある都道府県を地図でタップ</p>
        <p className="text-xl font-bold">中央区</p>
        <p className="text-xs text-muted-foreground mt-1">5 か所あります</p>
      </div>
      <div className="rounded-xl bg-background border h-72 overflow-hidden">
        <MiniJapanMap highlight="東京都" />
      </div>
    </div>
  );
}

function ModePreviewB() {
  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-xl bg-card border p-3 text-center">
        <p className="text-xs text-muted-foreground mb-1">この市区町村はどの都道府県？</p>
        <p className="text-xl font-bold">東京駅</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: '東京都', correct: true },
          { label: '大阪府', correct: false },
          { label: '神奈川県', correct: false },
          { label: '千葉県', correct: false },
        ].map((c) => (
          <div
            key={c.label}
            className={`rounded-lg border-2 py-2.5 text-center text-sm font-medium ${
              c.correct ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card'
            }`}
          >
            {c.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function ModePreviewC() {
  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-xl bg-card border p-3 text-center">
        <p className="text-xs text-muted-foreground mb-1">東京都の市区町村はどれ？</p>
        <p className="text-xl font-bold">東京都</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: '渋谷区', correct: true },
          { label: '大阪市', correct: false },
          { label: '横浜市', correct: false },
          { label: '千葉市', correct: false },
        ].map((c) => (
          <div
            key={c.label}
            className={`rounded-lg border-2 py-2.5 text-center text-sm font-medium ${
              c.correct ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card'
            }`}
          >
            {c.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function ModePreviewD() {
  return (
    <div className="flex flex-col gap-2">
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full w-[60%] bg-green-500" />
      </div>
      <div className="rounded-xl bg-card border p-3 text-center">
        <p className="text-xs text-muted-foreground mb-1">この市区町村を地図でタップ</p>
        <p className="text-xl font-bold">渋谷区</p>
        <p className="text-xs text-muted-foreground mt-1">（東京都）</p>
      </div>
      <div className="rounded-xl bg-background border h-72 overflow-hidden">
        <MiniJapanMap highlight="東京都" showZoomFrame />
      </div>
    </div>
  );
}

function ModePreview({ mode }: { mode: Mode }) {
  if (mode === 'A') return <ModePreviewA />;
  if (mode === 'B') return <ModePreviewB />;
  if (mode === 'C') return <ModePreviewC />;
  return <ModePreviewD />;
}

// ─── Page ──────────────────────────────────────────────────────────

export default function MunicipalityModeSelectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modeParam = searchParams.get('mode')?.toUpperCase() as Mode | undefined;
  const [selected, setSelected] = useState<Mode>(
    modeParam && (['A', 'B', 'C', 'D'] as Mode[]).includes(modeParam) ? modeParam : 'B',
  );
  const selectedInfo = MODES.find((m) => m.key === selected)!;

  function handleProceed() {
    router.push(`/quiz/municipality/${selected.toLowerCase()}`);
  }

  return (
    <div className="flex flex-col gap-4 p-4 max-w-4xl mx-auto">
      <Link
        href="/quiz"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ChevronLeft size={14} />
        クイズ選択に戻る
      </Link>
      <h1 className="text-xl font-semibold">市区町村クイズ・モード選択</h1>

      <div className="grid md:grid-cols-2 gap-4">
        {/* ── Mode cards ── */}
        <div className="grid grid-cols-2 gap-2 self-start">
          {MODES.map((m) => {
            const isSelected = m.key === selected;
            const Icon = m.Icon;
            return (
              <button
                key={m.key}
                onClick={() => setSelected(m.key)}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  isSelected
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon size={16} className={isSelected ? 'text-primary' : 'text-muted-foreground'} />
                  <span className={`text-xs font-bold ${isSelected ? 'text-primary' : ''}`}>
                    {m.shortLabel}
                  </span>
                </div>
                <p className={`text-sm font-medium ${isSelected ? 'text-primary' : ''}`}>
                  {m.longLabel}
                </p>
              </button>
            );
          })}
        </div>

        {/* ── Preview panel — fixed min height so the Start button doesn't jump ── */}
        <div className="flex flex-col gap-3 min-h-[30rem]">
          <div>
            <p className="text-sm font-medium">{selectedInfo.longLabel}</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {selectedInfo.description}
            </p>
          </div>
          <ModePreview mode={selected} />
        </div>
      </div>

      <Button onClick={handleProceed} className="w-full mt-2">
        {selectedInfo.shortLabel}・{selectedInfo.longLabel} で設定に進む
      </Button>
    </div>
  );
}
