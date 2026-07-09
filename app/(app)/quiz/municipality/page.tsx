'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, MapPin, List, HelpCircle, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RecommendHeroCard } from '@/components/recommend/recommend-hero-card';

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

      <RecommendHeroCard />

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

          <div className="mt-2">
            <details className="group border border-border rounded-xl p-3 bg-muted/10 transition-all [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex items-center justify-between font-medium text-xs cursor-pointer list-none select-none">
                <span className="flex items-center gap-1.5 text-muted-foreground group-hover:text-foreground transition-colors">
                  <HelpCircle size={14} />
                  出題ルールと除外について（同名市区町村など）
                </span>
                <ChevronDown size={14} className="text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <div className="mt-2.5 text-[11px] text-muted-foreground leading-relaxed border-t border-border/50 pt-2.5 flex flex-col gap-3">
                <div>
                  <p className="font-semibold text-foreground mb-0.5">都道府県名と同一の市区町村（同名除外）</p>
                  <p>
                    「青森市（青森県）」や「秋田市（秋田県）」などのように、名前から都道府県が自明な市区町村は、テキスト形式のクイズ（<b>モードA・B・C</b>）では難易度調整のため<b>出題から自動的に除外</b>されます。<br />
                    地図上の位置当てが本質である<b>モードD（順引き地図）</b>では除外されずに出題されます。
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-foreground mb-0.5">同じ名前の市区町村（政令市の区など）</p>
                  <p>
                    「中央区」などの同名市区町村は、テキスト形式の<b>モードA・B・C</b>では<b>1問に集約</b>されます。
                  </p>
                  <ul className="list-disc pl-4 mt-1 space-y-1">
                    <li><b>モードA（逆引き地図）</b>: 「中央区」が出題された場合、地図上で該当するすべての都道府県（東京都、大阪府、福岡県、新潟県など）をすべてタップすると正解になります。</li>
                    <li><b>モードB・C（4択）</b>: 重複が排除され、1つの代表問題として出題されます。</li>
                  </ul>
                  <p className="mt-1">
                    なお、<b>モードD（順引き地図）</b>では、各区（例：札幌市中央区）が個別に独立して出題されます。
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-foreground mb-0.5">複数県にまたがる同名市</p>
                  <p>
                    「府中市（東京都／広島県）」などの同名市も、<b>モードAでは1問に集約</b>され、地図上で該当するすべての都道府県（東京都と広島県）をタップすると正解になります。
                  </p>
                </div>
              </div>
            </details>
          </div>
        </div>
      </div>

      <Button onClick={handleProceed} className="w-full mt-2">
        {selectedInfo.shortLabel}・{selectedInfo.longLabel} で設定に進む
      </Button>
    </div>
  );
}
