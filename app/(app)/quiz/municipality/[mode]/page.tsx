'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { notFound, useParams, useSearchParams } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMunicipalityWeakness } from '@/lib/hooks/useMunicipalityWeakness';
import { useMunicipalityMaster } from '@/lib/hooks/useMunicipalityMaster';
import { RecommendReplayButton } from '@/components/recommend/recommend-replay-button';
import { QuizRunner } from '@/components/quiz/quiz-runner';
import type { Question } from '@/components/quiz/quiz-runner';
import {
  type Difficulty,
  type GameMode,
  type Municipality,
  type Region,
  type SessionCount,
  DIFFICULTIES,
  DIFFICULTY_LABEL,
  REGIONS,
  SESSION_COUNTS,
  ALL_PREFECTURES,
  filterByDifficulty,
  filterByRegions,
  filterSameName,
  getRegionsPrefectures,
  isModeAvailable,
  shuffle,
  weightedSample,
} from '@/lib/quiz/municipality-data';

// ─── Types ─────────────────────────────────────────────────────────

interface Settings {
  mode: GameMode;
  regions: Region[];
  count: SessionCount;
  weaknessFirst: boolean;
  difficulties: Difficulty[];
}

interface ResultEntry {
  name: string;
  prefecture: string;
  correct: boolean;
}

type Phase = 'setup' | 'playing' | 'result';

// ─── Question builder ───────────────────────────────────────────────

function buildQuestions(
  all: Municipality[],
  settings: Settings,
  weaknessMap: Map<string, number>,
): Question[] {
  const isTextMode = settings.mode === 'A' || settings.mode === 'B' || settings.mode === 'C';
  const source = isTextMode ? filterSameName(all) : all;
  const byRegion = filterByRegions(source, settings.regions);
  const filtered = filterByDifficulty(byRegion, settings.difficulties);
  const pool = settings.weaknessFirst
    ? weightedSample(filtered, weaknessMap, settings.count * 3)
    : shuffle(filtered);

  if (settings.mode === 'A') {
    const seen = new Set<string>();
    const questions: Question[] = [];
    for (const m of pool) {
      if (questions.length >= settings.count) break;
      if (seen.has(m.name)) continue;
      seen.add(m.name);
      const instances = all.filter((a) => a.name === m.name);
      questions.push({
        kind: 'A',
        name: m.name,
        instances,
        correctPrefectures: new Set(instances.map((i) => i.prefecture)),
      });
    }
    return questions;
  }

  const deduped = (() => {
    const seen = new Set<string>();
    return pool.filter((m) => {
      const key = `${m.name}::${m.prefecture}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  })();
  const sliced = deduped.slice(0, settings.count);

  const regionPrefs = getRegionsPrefectures(settings.regions);
  const regionPrefSet = new Set(regionPrefs);

  return sliced.map((m): Question => {
    if (settings.mode === 'B') {
      const prefPool = regionPrefs.length >= 4 ? regionPrefs : ALL_PREFECTURES;
      const distractors = shuffle(prefPool.filter((p) => p !== m.prefecture)).slice(0, 3);
      const choices = shuffle([m.prefecture, ...distractors]);
      return { kind: 'BCD', mode: 'B', municipality: m, choices };
    }
    const useRegionDistractors = regionPrefs.length >= 4;
    const namesInTargetPref = new Set(all.filter((a) => a.prefecture === m.prefecture).map((a) => a.name));
    const distractorPool = new Map<string, Municipality>();
    for (const c of all) {
      if (c.prefecture === m.prefecture) continue;
      if (useRegionDistractors && !regionPrefSet.has(c.prefecture)) continue;
      if (namesInTargetPref.has(c.name)) continue;
      if (distractorPool.has(c.name)) continue;
      distractorPool.set(c.name, c);
    }
    const distractors = shuffle([...distractorPool.values()]).slice(0, 3).map((d) => d.name);
    const choices = shuffle([m.name, ...distractors]);
    return { kind: 'BCD', mode: settings.mode as 'C' | 'D', municipality: m, choices };
  });
}

// ─── Component ─────────────────────────────────────────────────────

const VALID_MODES = ['A', 'B', 'C', 'D'] as const;
const MODE_LABEL: Record<GameMode, string> = {
  A: 'モードA・逆引き地図',
  B: 'モードB・逆引き4択',
  C: 'モードC・順引き4択',
  D: 'モードD・順引き地図',
};

export default function MunicipalityQuizPage() {
  const params = useParams<{ mode: string }>();
  const searchParams = useSearchParams();
  const modeFromUrl = (params.mode ?? '').toUpperCase() as GameMode;
  if (!VALID_MODES.includes(modeFromUrl)) notFound();

  const initDifficulty = searchParams.get('difficulty') as Difficulty | null;
  const initDifficultiesParam = searchParams.get('difficulties');
  const initRegion = searchParams.get('region') as Region | null;
  const sourceParam = searchParams.get('source');
  const countParam = searchParams.get('count');
  const isRecommendSource = sourceParam === 'recommend';
  const recommendCount = countParam ? (parseInt(countParam, 10) as 10 | 20 | 30) : null;

  const initRegions = initRegion
    ? initRegion.split(',').filter((r) => (REGIONS as readonly string[]).includes(r)) as Region[]
    : null;

  const initDifficulties: Difficulty[] | null = initDifficultiesParam
    ? (initDifficultiesParam.split(',').filter((d) => DIFFICULTIES.includes(d as Difficulty)) as Difficulty[])
    : initDifficulty && DIFFICULTIES.includes(initDifficulty as Difficulty)
      ? [initDifficulty as Difficulty]
      : null;

  const [phase, setPhase] = useState<Phase>('setup');
  const [settings, setSettings] = useState<Settings>({
    mode: modeFromUrl,
    regions: initRegions && initRegions.length > 0 ? initRegions : ['全国'],
    count: recommendCount && [10, 20, 30].includes(recommendCount) ? recommendCount : 10,
    weaknessFirst: false,
    difficulties: initDifficulties && initDifficulties.length > 0 ? initDifficulties : ['easy', 'medium'],
  });
  const [questions, setQuestions] = useState<Question[]>([]);
  const [results, setResults] = useState<ResultEntry[]>([]);

  const { data: weaknessData = [] } = useMunicipalityWeakness();
  const { data: masterData, isLoading: masterLoading } = useMunicipalityMaster();

  const allMunicipalities: Municipality[] = useMemo(
    () =>
      (masterData ?? []).map((m) => ({
        code: m.code,
        name: m.name,
        prefecture: m.prefecture,
        region: m.region,
        difficulty: m.difficulty as Difficulty,
      })),
    [masterData],
  );

  // ── Back-button interception during play ──
  useEffect(() => {
    if (phase !== 'playing') return;
    window.history.pushState(null, '');
    function handlePopState() { setPhase('setup'); }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [phase]);

  // ── Start ──
  function handleStart() {
    const weaknessMap = new Map<string, number>(
      weaknessData.map((w) => [w.municipalityCode, w.errorRate]),
    );
    const qs = buildQuestions(allMunicipalities, settings, weaknessMap);
    if (qs.length === 0) return;
    setQuestions(qs);
    setResults([]);
    setPhase('playing');
  }

  // ── Auto-start when coming from recommend ──
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!isRecommendSource || autoStarted.current || masterLoading || allMunicipalities.length === 0 || phase !== 'setup') return;
    const weaknessMap = new Map<string, number>(weaknessData.map((w) => [w.municipalityCode, w.errorRate]));
    const qs = buildQuestions(allMunicipalities, settings, weaknessMap);
    if (qs.length === 0) return;
    autoStarted.current = true;
    setQuestions(qs);
    setResults([]);
    setPhase('playing');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecommendSource, masterLoading, allMunicipalities]);

  const effectivePoolSize = useMemo(() => {
    if (allMunicipalities.length === 0) return 0;
    const isTextMode = settings.mode === 'A' || settings.mode === 'B' || settings.mode === 'C';
    const source = isTextMode ? filterSameName(allMunicipalities) : allMunicipalities;
    const filtered = filterByDifficulty(
      filterByRegions(source, settings.regions),
      settings.difficulties,
    );
    if (settings.mode === 'A') return new Set(filtered.map((m) => m.name)).size;
    return filtered.length;
  }, [allMunicipalities, settings.regions, settings.difficulties, settings.mode]);

  const modeAvailable = isModeAvailable(modeFromUrl, settings.regions);
  const canStart =
    !masterLoading &&
    allMunicipalities.length > 0 &&
    settings.difficulties.length > 0 &&
    effectivePoolSize > 0 &&
    modeAvailable;
  const startLabel = masterLoading || allMunicipalities.length === 0
    ? 'データ読み込み中...'
    : !modeAvailable
      ? '地域を追加してください'
      : settings.difficulties.length === 0
        ? '難易度を選択してください'
        : effectivePoolSize === 0
          ? '該当する市区町村なし — 地域か難易度を変更してください'
          : 'スタート';

  // ─── Render: Setup ──────────────────────────────────────────────

  if (phase === 'setup') {
    return (
      <div className="flex flex-col gap-5 p-4 max-w-md mx-auto">
        <Link
          href={`/quiz/municipality?mode=${modeFromUrl}`}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={14} />
          モード選択に戻る
        </Link>
        <div>
          <h1 className="text-xl font-semibold">市区町村クイズ</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{MODE_LABEL[modeFromUrl]}</p>
        </div>

        <div>
          <p className="text-sm font-medium mb-2">地域（複数選択可）</p>
          <div className="flex flex-wrap gap-2">
            {REGIONS.map((r) => {
              const isSelected =
                r === '全国'
                  ? settings.regions.includes('全国')
                  : !settings.regions.includes('全国') && settings.regions.includes(r);
              return (
                <button
                  key={r}
                  onClick={() =>
                    setSettings((s) => {
                      let newRegions: Region[];
                      if (r === '全国') {
                        newRegions = ['全国'];
                      } else {
                        const without全国 = s.regions.filter((x) => x !== '全国');
                        const already = without全国.includes(r);
                        const toggled = already
                          ? without全国.filter((x) => x !== r)
                          : [...without全国, r];
                        newRegions = toggled.length === 0 ? ['全国'] : toggled;
                      }
                      return { ...s, regions: newRegions };
                    })
                  }
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    isSelected
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  {r}
                </button>
              );
            })}
          </div>
          {!isModeAvailable(modeFromUrl, settings.regions) && (
            <p className="text-xs text-yellow-500 mt-2">
              {MODE_LABEL[modeFromUrl]} は2県以上の地域が必要です。地域を追加してください。
            </p>
          )}
        </div>

        <div>
          <p className="text-sm font-medium mb-2">問題数</p>
          <div className="flex gap-2">
            {SESSION_COUNTS.map((c) => (
              <button
                key={c}
                onClick={() => setSettings((s) => ({ ...s, count: c }))}
                className={`flex-1 rounded-xl border py-2 text-sm transition-colors ${
                  settings.count === c
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                {c}問
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium mb-2">難易度</p>
          <div className="flex flex-wrap gap-2">
            {DIFFICULTIES.map((d) => {
              const selected = settings.difficulties.includes(d);
              return (
                <button
                  key={d}
                  disabled={masterLoading || allMunicipalities.length === 0}
                  onClick={() =>
                    setSettings((s) => ({
                      ...s,
                      difficulties: selected
                        ? s.difficulties.filter((x) => x !== d)
                        : [...s.difficulties, d],
                    }))
                  }
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    selected
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  {DIFFICULTY_LABEL[d]}
                </button>
              );
            })}
          </div>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.weaknessFirst}
            onChange={(e) => setSettings((s) => ({ ...s, weaknessFirst: e.target.checked }))}
            className="w-4 h-4"
          />
          <span className="text-sm">苦手優先モード</span>
        </label>

        <Button onClick={handleStart} disabled={!canStart} className="w-full">
          {startLabel}
        </Button>
        {effectivePoolSize > 0 && effectivePoolSize < settings.count && canStart && (
          <p className="text-xs text-yellow-500 text-center">
            該当 {effectivePoolSize} 件のみ — 毎回同じ問題が繰り返されます。難易度か地域を広げてください
          </p>
        )}
      </div>
    );
  }

  // ─── Render: Result ─────────────────────────────────────────────

  if (phase === 'result') {
    const correct = results.filter((r) => r.correct).length;
    const wrong = results.filter((r) => !r.correct);
    const accuracy = results.length > 0 ? Math.round((correct / results.length) * 100) : 0;
    return (
      <div className="flex flex-col gap-4 p-4 max-w-md mx-auto">
        <Link
          href={`/quiz/municipality?mode=${modeFromUrl}`}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={14} />
          モード選択に戻る
        </Link>
        <h2 className="text-xl font-semibold text-center">結果</h2>
        <div className="text-center text-4xl font-bold text-primary">
          {correct} / {results.length}
        </div>
        <p className="text-center text-muted-foreground text-sm">正答率 {accuracy}%</p>

        {wrong.length > 0 && (
          <div className="rounded-xl bg-card p-4">
            <p className="text-sm font-medium mb-2">苦手な市区町村：</p>
            <div className="flex flex-wrap gap-1.5">
              {wrong.map((r, i) => (
                <span
                  key={i}
                  className="text-xs px-2 py-0.5 rounded-full bg-destructive/20 text-destructive"
                >
                  {r.name}（{r.prefecture}）
                </span>
              ))}
            </div>
          </div>
        )}

        {isRecommendSource && <RecommendReplayButton />}
        <Button onClick={() => setPhase('setup')} variant="outline" className="w-full">
          設定に戻る
        </Button>
        <Button onClick={handleStart} className="w-full">
          もう一度
        </Button>
      </div>
    );
  }

  // ─── Render: Playing ────────────────────────────────────────────

  return (
    <QuizRunner
      questions={questions}
      allMunicipalities={allMunicipalities}
      onAbort={() => setPhase('setup')}
      onComplete={(completedResults) => {
        setResults(completedResults);
        setPhase('result');
      }}
    />
  );
}
