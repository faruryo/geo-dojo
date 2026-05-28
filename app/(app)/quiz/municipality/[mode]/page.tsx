'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { notFound, useParams, useSearchParams } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useMunicipalityWeakness } from '@/lib/hooks/useMunicipalityWeakness';
import { useMunicipalityMaster } from '@/lib/hooks/useMunicipalityMaster';
import { saveMunicipalityQuizResult } from '../actions';
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
  getRegionsPrefectures,
  isModeAvailable,
  shuffle,
  weightedSample,
} from '@/lib/quiz/municipality-data';

const JapanMap = dynamic(
  () => import('@/components/map/JapanMap').then((m) => m.JapanMap),
  { ssr: false, loading: () => <div className="w-full aspect-square bg-muted rounded-xl animate-pulse" /> },
);
const MunicipalityMap = dynamic(
  () => import('@/components/map/MunicipalityMap').then((m) => m.MunicipalityMap),
  { ssr: false, loading: () => <div className="w-full aspect-square bg-muted rounded-xl animate-pulse" /> },
);

// ─── Types ─────────────────────────────────────────────────────────

interface Settings {
  mode: GameMode;
  regions: Region[];
  count: SessionCount;
  weaknessFirst: boolean;
  difficulties: Difficulty[];
}

interface ModeAQuestion {
  kind: 'A';
  name: string;
  instances: Municipality[];
  correctPrefectures: Set<string>;
}
interface SingleQuestion {
  kind: 'BCD';
  mode: 'B' | 'C' | 'D';
  municipality: Municipality;
  choices: string[];
}
type Question = ModeAQuestion | SingleQuestion;

interface ResultEntry {
  name: string;
  prefecture: string;
  correct: boolean;
}

type Phase = 'setup' | 'playing' | 'result';
type FeedbackState = 'idle' | 'correct' | 'incorrect';

const TIME_LIMIT_SEC = 30;

// ─── Question builder ───────────────────────────────────────────────

function buildQuestions(
  all: Municipality[],
  settings: Settings,
  weaknessMap: Map<string, number>,
): Question[] {
  // Apply region AND difficulty filters (per FR-018)
  const byRegion = filterByRegions(all, settings.regions);
  const filtered = filterByDifficulty(byRegion, settings.difficulties);
  const pool = settings.weaknessFirst
    ? weightedSample(filtered, weaknessMap, settings.count * 3)
    : shuffle(filtered);

  if (settings.mode === 'A') {
    const seen = new Set<string>();
    const questions: ModeAQuestion[] = [];
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

  // Mode B/C/D: same (name, prefecture) = identical question → deduplicate.
  // Mode D also deduplicates because ward-subdivided cities (e.g. 名古屋市) share
  // the same display name and any ward tap is accepted as correct.
  const deduped =
    settings.mode === 'B' || settings.mode === 'C' || settings.mode === 'D'
      ? (() => {
          const seen = new Set<string>();
          return pool.filter((m) => {
            const key = `${m.name}::${m.prefecture}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        })()
      : pool;
  const sliced = deduped.slice(0, settings.count);

  // Prefectures across all selected regions — used to restrict distractor pools.
  const regionPrefs = getRegionsPrefectures(settings.regions);
  // Fall back to all-Japan when the combined region set has fewer than 4 prefectures
  // (can't fill 3 distractor slots from within the region alone).
  const regionPrefSet = new Set(regionPrefs);

  return sliced.map((m): SingleQuestion => {
    if (settings.mode === 'B') {
      // Distractors: other prefectures within the same region.
      // Fallback to all-Japan if the region has <4 prefectures (can't fill 3 slots).
      const prefPool = regionPrefs.length >= 4 ? regionPrefs : ALL_PREFECTURES;
      const distractors = shuffle(prefPool.filter((p) => p !== m.prefecture)).slice(0, 3);
      const choices = shuffle([m.prefecture, ...distractors]);
      return { kind: 'BCD', mode: 'B', municipality: m, choices };
    }
    // C or D: distractors are unique-named cities from OTHER prefectures in the
    // same region. Exclude any name that also exists in the target prefecture
    // (e.g. 中央区) so the only correct city in choices is m.name itself.
    // Fall back to all-Japan when the region has <4 prefectures (too few options).
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
  const initRegion = searchParams.get('region') as Region | null;

  const [phase, setPhase] = useState<Phase>('setup');
  const [settings, setSettings] = useState<Settings>({
    mode: modeFromUrl,
    regions: initRegion && (REGIONS as readonly string[]).includes(initRegion) ? [initRegion as Region] : ['全国'],
    count: 10,
    weaknessFirst: false,
    difficulties: initDifficulty && DIFFICULTIES.includes(initDifficulty as Difficulty) ? [initDifficulty as Difficulty] : ['easy', 'medium'],
  });
  const [questions, setQuestions] = useState<Question[]>([]);
  const [qIdx, setQIdx] = useState(0);
  const [feedback, setFeedback] = useState<FeedbackState>('idle');
  const [results, setResults] = useState<ResultEntry[]>([]);
  const [modeDFailed, setModeDFailed] = useState(false);

  // Mode A state
  const [selectedPrefectures, setSelectedPrefectures] = useState<Set<string>>(new Set());

  // Mode B/C state
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);

  // Mode D highlight state
  const [correctCodes, setCorrectCodes] = useState<string[]>([]);
  const [wrongCodes, setWrongCodes] = useState<string[]>([]);

  // Countdown timer (mode D only)
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT_SEC);

  const { data: weaknessData = [] } = useMunicipalityWeakness();
  const { data: masterData, isLoading: masterLoading } = useMunicipalityMaster();

  // Map DB rows to the runtime Municipality shape used throughout the quiz.
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

  const currentQuestion = questions[qIdx] ?? null;

  // ── Back-button interception during play: send user to mode-select page ──
  useEffect(() => {
    if (phase !== 'playing') return;

    window.history.pushState(null, '');

    function handlePopState() {
      setPhase('setup');
    }

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
    setQIdx(0);
    setResults([]);
    setFeedback('idle');
    setSelectedPrefectures(new Set());
    setSelectedChoice(null);
    setCorrectCodes([]);
    setWrongCodes([]);
    setModeDFailed(false);
    setPhase('playing');
  }

  // ── Advance to next question ──
  const advanceQuestion = useCallback(() => {
    setFeedback('idle');
    setSelectedPrefectures(new Set());
    setSelectedChoice(null);
    setCorrectCodes([]);
    setWrongCodes([]);
    setModeDFailed(false);
    setQIdx((i) => {
      if (i + 1 >= questions.length) {
        setPhase('result');
        return i;
      }
      return i + 1;
    });
  }, [questions.length]);

  // ── Save result + advance ──
  const recordAndAdvance = useCallback(
    async (entries: { municipality: Municipality; isCorrect: boolean; mode: GameMode }[]) => {
      setResults((prev) => [
        ...prev,
        ...entries.map((e) => ({ name: e.municipality.name, prefecture: e.municipality.prefecture, correct: e.isCorrect })),
      ]);
      await Promise.allSettled(
        entries.map((e) =>
          saveMunicipalityQuizResult({
            municipalityCode: e.municipality.code,
            municipalityName: e.municipality.name,
            prefecture: e.municipality.prefecture,
            mode: e.mode,
            isCorrect: e.isCorrect,
          }),
        ),
      );
    },
    [],
  );

  // ── Mode A: prefecture map tap ──
  const handlePrefectureTap = useCallback(
    (name: string) => {
      if (feedback !== 'idle') return;
      setSelectedPrefectures((prev) => {
        const next = new Set(prev);
        if (next.has(name)) next.delete(name);
        else next.add(name);
        return next;
      });
    },
    [feedback],
  );

  // ── Mode A: submit ──
  const handleModeASubmit = useCallback(async () => {
    if (!currentQuestion || currentQuestion.kind !== 'A') return;
    const { instances, correctPrefectures } = currentQuestion;

    const correct =
      selectedPrefectures.size === correctPrefectures.size &&
      [...correctPrefectures].every((p) => selectedPrefectures.has(p));

    setFeedback(correct ? 'correct' : 'incorrect');
    await recordAndAdvance(
      instances.map((m) => ({ municipality: m, isCorrect: correct, mode: 'A' })),
    );
    setTimeout(advanceQuestion, 1500);
  }, [currentQuestion, selectedPrefectures, recordAndAdvance, advanceQuestion]);

  // ── Mode B: prefecture choice ──
  const handleBChoice = useCallback(
    async (choice: string) => {
      if (feedback !== 'idle' || !currentQuestion || currentQuestion.kind !== 'BCD') return;
      const { municipality } = currentQuestion;
      const correct = choice === municipality.prefecture;
      setSelectedChoice(choice);
      setFeedback(correct ? 'correct' : 'incorrect');
      await recordAndAdvance([{ municipality, isCorrect: correct, mode: 'B' }]);
      setTimeout(advanceQuestion, 1200);
    },
    [feedback, currentQuestion, recordAndAdvance, advanceQuestion],
  );

  // ── Mode C: municipality choice ──
  const handleCChoice = useCallback(
    async (choice: string) => {
      if (feedback !== 'idle' || !currentQuestion || currentQuestion.kind !== 'BCD') return;
      const { municipality } = currentQuestion;
      const correct = choice === municipality.name;
      setSelectedChoice(choice);
      setFeedback(correct ? 'correct' : 'incorrect');
      await recordAndAdvance([{ municipality, isCorrect: correct, mode: 'C' }]);
      setTimeout(advanceQuestion, 1200);
    },
    [feedback, currentQuestion, recordAndAdvance, advanceQuestion],
  );

  // ── Mode D: municipality map tap ──
  const handleDTap = useCallback(
    async (code: string, tappedName: string) => {
      if (feedback !== 'idle' || !currentQuestion || currentQuestion.kind !== 'BCD') return;
      const { municipality } = currentQuestion;
      // Accept any polygon whose display name matches — handles ward-subdivided cities
      // (e.g. 名古屋市 where 16 wards each have a distinct code but share the same nam_ja).
      const correct = tappedName === municipality.name;
      const allCorrectCodes = allMunicipalities
        .filter((m) => m.name === municipality.name && m.prefecture === municipality.prefecture)
        .map((m) => m.code);
      if (correct) {
        setCorrectCodes(allCorrectCodes);
      } else {
        setWrongCodes([code]);
        setCorrectCodes(allCorrectCodes);
      }
      setFeedback(correct ? 'correct' : 'incorrect');
      await recordAndAdvance([{ municipality, isCorrect: correct, mode: 'D' }]);
      setTimeout(advanceQuestion, 1500);
    },
    [feedback, currentQuestion, allMunicipalities, recordAndAdvance, advanceQuestion],
  );

  const handleModeDFallback = useCallback(() => setModeDFailed(true), []);

  // ── Timeout: mode D only — auto-grade as incorrect ──
  const handleTimeout = useCallback(async () => {
    if (feedback !== 'idle' || !currentQuestion) return;
    if (currentQuestion.kind === 'BCD' && currentQuestion.mode === 'D' && !modeDFailed) {
      const { municipality } = currentQuestion;
      const allCorrectCodes = allMunicipalities
        .filter((m) => m.name === municipality.name && m.prefecture === municipality.prefecture)
        .map((m) => m.code);
      setCorrectCodes(allCorrectCodes);
      setFeedback('incorrect');
      await recordAndAdvance([{ municipality, isCorrect: false, mode: 'D' }]);
      setTimeout(advanceQuestion, 1500);
    }
  }, [feedback, currentQuestion, modeDFailed, allMunicipalities, recordAndAdvance, advanceQuestion]);

  // ── Countdown for mode D ──
  // Resets on question change, stops once feedback is shown. Tick once per
  // second; trigger handleTimeout at 0 instead of letting timeLeft go negative.
  useEffect(() => {
    if (phase !== 'playing' || feedback !== 'idle' || !currentQuestion) return;
    const isTimed =
      currentQuestion.kind === 'BCD' && currentQuestion.mode === 'D' && !modeDFailed;
    if (!isTimed) return;

    setTimeLeft(TIME_LIMIT_SEC);
    let remaining = TIME_LIMIT_SEC;
    const interval = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(interval);
        setTimeLeft(0);
        handleTimeout();
      } else {
        setTimeLeft(remaining);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, feedback, qIdx, currentQuestion, modeDFailed, handleTimeout]);

  // Pool size after region + difficulty filters — drives Start button state.
  // For mode A, the playable count is unique-name count, not raw rows.
  const effectivePoolSize = useMemo(() => {
    if (allMunicipalities.length === 0) return 0;
    const filtered = filterByDifficulty(
      filterByRegions(allMunicipalities, settings.regions),
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
          href="/quiz/municipality"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={14} />
          モード選択に戻る
        </Link>
        <div>
          <h1 className="text-xl font-semibold">市区町村クイズ</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{MODE_LABEL[modeFromUrl]}</p>
        </div>

        {/* Region — multi-select chips; '全国' is a "select all" shortcut */}
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
                        // Collapse back to '全国' if nothing is left
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

        {/* Count */}
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

        {/* Difficulty */}
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

        {/* Weakness */}
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.weaknessFirst}
            onChange={(e) => setSettings((s) => ({ ...s, weaknessFirst: e.target.checked }))}
            className="w-4 h-4"
          />
          <span className="text-sm">苦手優先モード</span>
        </label>

        <Button
          onClick={handleStart}
          disabled={!canStart}
          className="w-full"
        >
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
          href="/quiz/municipality"
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

  if (!currentQuestion) return null;
  const progressText = `${qIdx + 1} / ${questions.length}`;
  const correctCount = results.filter((r) => r.correct).length;

  // Countdown bar — green → yellow → red as time runs out. Rendered above
  // the question card in mode D only.
  const countdownBar = (
    <div className="shrink-0 space-y-0.5">
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full transition-[width] duration-1000 ease-linear"
          style={{
            width: `${(timeLeft / TIME_LIMIT_SEC) * 100}%`,
            backgroundColor: timeLeft > 8 ? '#22c55e' : timeLeft > 4 ? '#eab308' : '#ef4444',
          }}
        />
      </div>
      <p className="text-[10px] text-right text-muted-foreground">残り {timeLeft} 秒</p>
    </div>
  );

  // ── Mode A ──
  if (currentQuestion.kind === 'A') {
    const { name, correctPrefectures } = currentQuestion;
    const remaining = correctPrefectures.size - selectedPrefectures.size;
    const canSubmit = remaining === 0 && feedback === 'idle';

    return (
      <div className="flex flex-col h-full gap-2 p-3 max-w-4xl mx-auto">
        <div className="flex items-center justify-between text-xs text-muted-foreground shrink-0">
          <button
            onClick={() => setPhase('setup')}
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <ChevronLeft size={14} />
            中断
          </button>
          <span>{progressText}</span>
          <span>{correctCount} 正解</span>
        </div>

        <div className="rounded-xl bg-card p-3 text-center shrink-0">
          <p className="text-xs text-muted-foreground mb-1">この市区町村がある都道府県を地図でタップ</p>
          <p className="text-2xl font-bold">{name}</p>
          {correctPrefectures.size > 1 && (
            <p className="text-xs text-muted-foreground mt-1">{correctPrefectures.size} か所あります</p>
          )}
          {feedback === 'idle' && correctPrefectures.size > 1 && selectedPrefectures.size < correctPrefectures.size && (
            <p className="text-xs text-yellow-500 mt-1">あと {remaining} か所</p>
          )}
        </div>

        {feedback !== 'idle' && (
          <div className={`text-center text-base font-semibold shrink-0 ${feedback === 'correct' ? 'text-green-500' : 'text-red-500'}`}>
            {feedback === 'correct' ? '✓ 正解！' : `✗ 不正解（${[...correctPrefectures].join('・')}）`}
          </div>
        )}

        <div className="flex-1 min-h-0 w-full">
          <JapanMap
            onPrefectureClick={handlePrefectureTap}
            selectedNames={[...selectedPrefectures]}
            highlightCorrect={feedback !== 'idle' ? [...correctPrefectures] : undefined}
            highlightWrong={undefined}
          />
        </div>

        {selectedPrefectures.size > 0 && feedback === 'idle' && (
          <div className="flex flex-wrap gap-1 shrink-0 max-h-12 overflow-y-auto">
            {[...selectedPrefectures].map((p) => (
              <Badge key={p} variant="secondary" className="text-xs">{p}</Badge>
            ))}
          </div>
        )}

        <Button onClick={handleModeASubmit} disabled={!canSubmit} className="w-full shrink-0">
          {feedback !== 'idle' ? '次へ...' : canSubmit ? '解答する' : `あと ${remaining} か所選択`}
        </Button>
      </div>
    );
  }

  // ── Mode B / C / D ──
  const { municipality, choices, mode } = currentQuestion;

  // Mode D with fallback to C
  const effectiveMode = mode === 'D' && modeDFailed ? 'C' : mode;

  return (
    <div className="flex flex-col h-full gap-2 p-3 max-w-4xl mx-auto">
      <div className="flex items-center justify-between text-xs text-muted-foreground shrink-0">
        <button
          onClick={() => setPhase('setup')}
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <ChevronLeft size={14} />
          中断
        </button>
        <span>{progressText}</span>
        <span>{correctCount} 正解</span>
      </div>

      {effectiveMode === 'D' && countdownBar}

      <div className="rounded-xl bg-card p-3 text-center shrink-0">
        {mode === 'B' ? (
          <>
            <p className="text-xs text-muted-foreground mb-1">この市区町村はどの都道府県？</p>
            <p className="text-2xl font-bold">{municipality.name}</p>
          </>
        ) : effectiveMode === 'D' ? (
          <>
            <p className="text-xs text-muted-foreground mb-1">この市区町村を地図でタップ</p>
            <p className="text-2xl font-bold">{municipality.name}</p>
            <p className="text-xs text-muted-foreground mt-1">（{municipality.prefecture}）</p>
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-1">{municipality.prefecture}の市区町村はどれ？</p>
            <p className="text-xl font-bold">{municipality.prefecture}</p>
          </>
        )}
      </div>

      {feedback !== 'idle' && (
        <div className={`text-center text-base font-semibold shrink-0 ${feedback === 'correct' ? 'text-green-500' : 'text-red-500'}`}>
          {feedback === 'correct'
            ? '✓ 正解！'
            : `✗ 不正解（${mode === 'B' ? municipality.prefecture : municipality.name}）`}
        </div>
      )}

      {modeDFailed && (
        <p className="text-center text-xs text-muted-foreground shrink-0">
          地図データの読み込みに失敗しました（モードCで代替表示）
        </p>
      )}

      {effectiveMode === 'D' ? (
        <div className="flex-1 min-h-0 w-full">
          <MunicipalityMap
            prefecture={municipality.prefecture}
            onMunicipalityClick={handleDTap}
            highlightCodes={correctCodes}
            wrongCodes={wrongCodes}
            onLoadError={handleModeDFallback}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {choices.map((choice) => {
            const isSelected = selectedChoice === choice;
            const isCorrect = mode === 'B' ? choice === municipality.prefecture : choice === municipality.name;
            let btnStyle = 'border-border hover:border-primary/50';
            if (feedback !== 'idle' && isSelected && isCorrect) btnStyle = 'border-green-500 bg-green-500/10 text-green-500';
            else if (feedback !== 'idle' && isSelected && !isCorrect) btnStyle = 'border-red-500 bg-red-500/10 text-red-500';
            else if (feedback !== 'idle' && isCorrect) btnStyle = 'border-green-500 bg-green-500/10 text-green-500';

            return (
              <button
                key={choice}
                disabled={feedback !== 'idle'}
                onClick={() => (mode === 'B' ? handleBChoice : handleCChoice)(choice)}
                className={`w-full rounded-xl border p-3 text-left text-sm transition-colors ${btnStyle}`}
              >
                {choice}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
