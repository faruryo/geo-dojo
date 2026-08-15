'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Timer, Trophy, Sparkles } from 'lucide-react';
import { completionSeEvent, playSe } from '@/lib/quiz/sound-effects';
import { MuteToggle } from '@/components/quiz/mute-toggle';
import {
  PREFECTURE_KANA,
  REGIONS,
  type Region,
  getRegionsPrefectures,
} from '@/lib/quiz/municipality-data';
import {
  buildPrefectureQuestions,
  formatClearTime,
  isNewBestTime,
  type PrefectureQuizCount,
  type PrefectureQuizSettings,
  type PrefectureQuizType,
} from '@/lib/quiz/prefecture-quiz';

const JapanMap = dynamic(
  () => import('@/components/map/JapanMap').then((m) => m.JapanMap),
  { ssr: false, loading: () => <div className="w-full aspect-square bg-muted rounded-xl animate-pulse" /> },
);

const PREFECTURE_KANA_MAP = new Map<string, string>(Object.entries(PREFECTURE_KANA));

function getPrefectureKana(prefecture: string): string | undefined {
  return PREFECTURE_KANA_MAP.get(prefecture);
}

type Phase = 'setup' | 'playing' | 'result';
type QuestionFeedback = 'none' | 'correct' | 'wrong';

interface QuizResult {
  prefecture: string;
  correct: boolean;
}

const WEAKNESS_STORAGE_KEY = 'geodojo-prefecture-weakness';

function getStoredWeakness(): Map<string, number> {
  if (typeof window === 'undefined') return new Map();
  try {
    const raw = localStorage.getItem(WEAKNESS_STORAGE_KEY);
    if (!raw) return new Map();
    const obj = JSON.parse(raw) as Record<string, number>;
    return new Map(Object.entries(obj));
  } catch {
    return new Map();
  }
}

function saveWeakness(map: Map<string, number>) {
  if (typeof window === 'undefined') return;
  try {
    const obj = Object.fromEntries(map);
    localStorage.setItem(WEAKNESS_STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // ignore storage error
  }
}

function getBestTimeKey(settings: PrefectureQuizSettings): string {
  const regionsKey = [...settings.regions].sort((a, b) => a.localeCompare(b)).join(',');
  return `geodojo-prefecture-best-time:${regionsKey}:${settings.count}`;
}

function getStoredBestTime(key: string): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? parseInt(raw, 10) : null;
  } catch {
    return null;
  }
}

function saveBestTime(key: string, ms: number) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, String(ms));
  } catch {
    // ignore storage error
  }
}

const COUNT_OPTIONS: readonly { count: PrefectureQuizCount; getLabel: (max: number) => string }[] = [
  { count: 10, getLabel: () => '10問' },
  { count: 20, getLabel: () => '20問' },
  { count: 'all', getLabel: (max) => `全問 (${max}問)` },
];

const MODE_OPTIONS: readonly { type: PrefectureQuizType; label: string; desc: string }[] = [
  { type: 'normal', label: '通常モード', desc: 'じっくり学習' },
  { type: 'timeAttack', label: 'タイムアタック', desc: 'クリアタイムを競う' },
];

function getFeedbackDelay(type: PrefectureQuizType, isCorrect: boolean): number {
  if (type === 'timeAttack') {
    return isCorrect ? 500 : 900;
  }
  return 1200;
}

function updateWeaknessScore(target: string, isCorrect: boolean) {
  const weaknessMap = getStoredWeakness();
  const currentScore = weaknessMap.get(target) ?? 0;
  if (isCorrect) {
    if (currentScore > 0) {
      weaknessMap.set(target, Math.max(0, currentScore - 1));
    }
  } else {
    weaknessMap.set(target, currentScore + 1);
  }
  saveWeakness(weaknessMap);
}

function toggleRegion(current: readonly Region[], r: Region): Region[] {
  if (r === '全国') return ['全国'];
  const withoutAll = current.filter((x) => x !== '全国');
  const next = withoutAll.includes(r)
    ? withoutAll.filter((x) => x !== r)
    : [...withoutAll, r];
  return next.length === 0 ? ['全国'] : next;
}

function getStartButtonLabel(count: PrefectureQuizCount, max: number): string {
  if (max === 0) return '地域を選択してください';
  if (count === 'all') return `${max}問でスタート`;
  return `${Math.min(count, max)}問でスタート`;
}

export default function PrefectureQuizPage() {
  const [phase, setPhase] = useState<Phase>('setup');
  const [settings, setSettings] = useState<PrefectureQuizSettings>({
    regions: ['全国'],
    count: 10,
    type: 'normal',
    weaknessFirst: false,
  });

  const [questions, setQuestions] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [feedback, setFeedback] = useState<QuestionFeedback>('none');
  const [selected, setSelected] = useState<string | null>(null);
  const [results, setResults] = useState<QuizResult[]>([]);

  // タイム計測用
  const [elapsedMs, setElapsedMs] = useState(0);
  const [totalClearTimeMs, setTotalClearTimeMs] = useState(0);
  const [isBestUpdated, setIsBestUpdated] = useState(false);
  const [previousBestMs, setPreviousBestMs] = useState<number | null>(null);

  const startTimeRef = useRef<number>(0);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTransitioningRef = useRef(false);

  const clearPendingTransition = useCallback(() => {
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }
    isTransitioningRef.current = false;
  }, []);

  const target = questions[currentIndex] ?? '';
  const availablePool = useMemo(() => getRegionsPrefectures(settings.regions), [settings.regions]);
  const maxAvailableCount = availablePool.length;

  const handleStart = useCallback(() => {
    clearPendingTransition();
    const weaknessMap = getStoredWeakness();
    const qs = buildPrefectureQuestions(settings, weaknessMap);
    if (qs.length === 0) return;

    setQuestions(qs);
    setCurrentIndex(0);
    setResults([]);
    setFeedback('none');
    setSelected(null);
    setElapsedMs(0);
    setIsBestUpdated(false);

    const bestKey = getBestTimeKey(settings);
    setPreviousBestMs(getStoredBestTime(bestKey));

    startTimeRef.current = performance.now();
    setPhase('playing');
  }, [settings, clearPendingTransition]);

  // タイマー進行
  useEffect(() => {
    if (phase === 'playing') {
      startTimeRef.current = performance.now();
      timerIntervalRef.current = setInterval(() => {
        setElapsedMs(Math.round(performance.now() - startTimeRef.current));
      }, 50);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      clearPendingTransition();
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      clearPendingTransition();
    };
  }, [phase, clearPendingTransition]);

  const handleTap = useCallback(
    (name: string) => {
      if (phase !== 'playing' || feedback !== 'none' || isTransitioningRef.current) return;
      const tapTime = performance.now();
      isTransitioningRef.current = true;

      const isFinalQuestion = currentIndex + 1 >= questions.length;
      let recordedFinalTimeMs: number | null = null;

      if (isFinalQuestion) {
        recordedFinalTimeMs = Math.round(tapTime - startTimeRef.current);
        setTotalClearTimeMs(recordedFinalTimeMs);
        setElapsedMs(recordedFinalTimeMs);
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
      }

      const isCorrect = name === target;
      const updatedResults = [...results, { prefecture: target, correct: isCorrect }];
      setSelected(name);
      setFeedback(isCorrect ? 'correct' : 'wrong');
      playSe(isCorrect ? 'correct' : 'incorrect');
      setResults(updatedResults);
      updateWeaknessScore(target, isCorrect);

      const delayMs = getFeedbackDelay(settings.type, isCorrect);

      transitionTimeoutRef.current = setTimeout(() => {
        transitionTimeoutRef.current = null;
        if (isFinalQuestion && recordedFinalTimeMs !== null) {
          playSe(completionSeEvent(updatedResults));

          if (settings.type === 'timeAttack') {
            const bestKey = getBestTimeKey(settings);
            const currentBest = getStoredBestTime(bestKey);
            if (isNewBestTime(recordedFinalTimeMs, currentBest)) {
              saveBestTime(bestKey, recordedFinalTimeMs);
              setIsBestUpdated(true);
            }
          }

          setPhase('result');
        } else {
          setCurrentIndex((prev) => prev + 1);
          setSelected(null);
          setFeedback('none');
          isTransitioningRef.current = false;
        }
      }, delayMs);
    },
    [phase, feedback, target, results, currentIndex, questions.length, settings],
  );

  const backLink = (
    <Link
      href="/quiz"
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
      <ChevronLeft size={14} />
      クイズ選択に戻る
    </Link>
  );

  // ─── Setup Phase ──────────────────────────────────────────────────

  if (phase === 'setup') {
    return (
      <div className="flex flex-col gap-6 p-4 max-w-md mx-auto">
        {backLink}

        <div>
          <h1 className="text-xl font-bold">都道府県クイズ</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            47都道府県の形・位置を地図タップで答えるクイズ
          </p>
        </div>

        {/* 出題地域選択 */}
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            出題地域
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {REGIONS.map((r) => {
              const selected = settings.regions.includes(r);
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setSettings((prev) => ({ ...prev, regions: toggleRegion(prev.regions, r) }))}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    selected
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card text-foreground border-foreground/10 hover:border-foreground/30'
                  }`}
                >
                  {r}
                </button>
              );
            })}
          </div>
        </section>

        {/* 出題数選択 */}
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            出題数
          </h2>
          <div className="flex gap-2">
            {COUNT_OPTIONS.map((opt) => {
              const isSelected = settings.count === opt.count;
              return (
                <button
                  key={String(opt.count)}
                  type="button"
                  onClick={() => setSettings((prev) => ({ ...prev, count: opt.count }))}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                    isSelected
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card text-foreground border-foreground/10 hover:border-foreground/30'
                  }`}
                >
                  {opt.getLabel(maxAvailableCount)}
                </button>
              );
            })}
          </div>
        </section>

        {/* モード選択（通常 / タイムアタック） */}
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            モード
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {MODE_OPTIONS.map((m) => {
              const isSelected = settings.type === m.type;
              return (
                <button
                  key={m.type}
                  type="button"
                  onClick={() => setSettings((prev) => ({ ...prev, type: m.type }))}
                  className={`p-3 rounded-xl text-left border transition-colors flex flex-col gap-0.5 ${
                    isSelected
                      ? 'bg-primary/10 border-primary text-foreground ring-1 ring-primary'
                      : 'bg-card border-foreground/10 text-foreground hover:border-foreground/30'
                  }`}
                >
                  <span className="text-xs font-semibold">{m.label}</span>
                  <span className="text-[10px] text-muted-foreground">{m.desc}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 苦手優先トグル */}
        <section className="flex items-center justify-between p-3 rounded-xl bg-card border border-foreground/10">
          <div>
            <p className="text-xs font-semibold">苦手な問題を優先</p>
            <p className="text-[10px] text-muted-foreground">過去の誤答データに基づいて優先出題</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.weaknessFirst}
            onClick={() => setSettings((prev) => ({ ...prev, weaknessFirst: !prev.weaknessFirst }))}
            className={`w-10 h-6 rounded-full transition-colors relative ${
              settings.weaknessFirst ? 'bg-primary' : 'bg-foreground/20'
            }`}
          >
            <span
              className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                settings.weaknessFirst ? 'translate-x-5' : 'translate-x-1'
              }`}
            />
          </button>
        </section>

        {/* スタートボタン */}
        <Button
          onClick={handleStart}
          disabled={maxAvailableCount === 0}
          className="w-full py-5 text-sm font-semibold"
        >
          {getStartButtonLabel(settings.count, maxAvailableCount)}
        </Button>
      </div>
    );
  }

  // ─── Result Phase ─────────────────────────────────────────────────

  if (phase === 'result') {
    const correct = results.filter((r) => r.correct).length;
    const wrong = results.filter((r) => !r.correct);
    const totalCount = results.length;
    const accuracy = totalCount > 0 ? Math.round((correct / totalCount) * 100) : 0;

    return (
      <div className="flex flex-col gap-4 p-4 max-w-md mx-auto">
        <button
          type="button"
          onClick={() => setPhase('setup')}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors self-start"
        >
          <ChevronLeft size={14} />
          設定に戻る
        </button>

        <h2 className="text-xl font-semibold text-center">結果</h2>

        <div className="text-center text-4xl font-bold text-primary">
          {correct} / {totalCount}
        </div>
        <p className="text-center text-muted-foreground text-sm">正答率 {accuracy}%</p>

        {/* タイム表示 */}
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 flex flex-col gap-2 items-center">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Timer size={14} />
            <span>クリアタイム</span>
          </div>
          <p className="text-2xl font-bold tabular-nums text-foreground">
            {formatClearTime(totalClearTimeMs)}
          </p>

          {settings.type === 'timeAttack' && (
            <div className="flex items-center gap-2 mt-1">
              {isBestUpdated && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-500 border border-amber-500/30">
                  <Sparkles size={12} />
                  自己ベスト更新！
                </span>
              )}
              {!isBestUpdated && previousBestMs !== null && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Trophy size={12} />
                  自己ベスト: {formatClearTime(previousBestMs)}
                </span>
              )}
            </div>
          )}
        </div>

        {wrong.length > 0 && (
          <div className="rounded-xl bg-card p-4">
            <p className="text-sm font-medium mb-2">苦手な都道府県：</p>
            <div className="flex flex-wrap gap-1.5">
              {wrong.map((r) => {
                const kana = getPrefectureKana(r.prefecture);
                return (
                  <span
                    key={r.prefecture}
                    className="text-xs px-2 py-0.5 rounded-full bg-destructive/20 text-destructive"
                  >
                    {r.prefecture}
                    {kana ? `（${kana}）` : ''}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        <Button onClick={handleStart} className="w-full">
          もう一度
        </Button>
        <Button onClick={() => setPhase('setup')} variant="outline" className="w-full">
          設定に戻る
        </Button>
      </div>
    );
  }

  // ─── Playing Phase ────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-3 p-4 max-w-md mx-auto">
      <button
        type="button"
        onClick={() => setPhase('setup')}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors self-start"
      >
        <ChevronLeft size={14} />
        中断して設定に戻る
      </button>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {currentIndex + 1} / {questions.length}
        </span>
        <div className="inline-flex items-center gap-3">
          <span className="inline-flex items-center gap-1 font-mono text-xs text-foreground/80">
            <Timer size={13} className="text-muted-foreground" />
            {formatClearTime(elapsedMs)}
          </span>
          <MuteToggle />
        </div>
      </div>

      <div className="rounded-xl bg-card p-4 text-center">
        <p className="text-xs text-muted-foreground mb-1">どこにある？</p>
        <p className="text-2xl font-bold">{target}</p>
      </div>

      {feedback !== 'none' && (
        <div className="text-center">
          <div
            className={`text-lg font-semibold ${
              feedback === 'correct' ? 'text-green-500' : 'text-red-500'
            }`}
          >
            {feedback === 'correct' ? '✓ 正解！' : '✗ 不正解'}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {target}
            {getPrefectureKana(target) ? `（${getPrefectureKana(target)}）` : ''}
          </p>
        </div>
      )}

      <div className="w-full max-w-lg mx-auto self-center">
        <JapanMap
          onPrefectureClick={handleTap}
          highlightCorrect={feedback !== 'none' ? target : undefined}
          highlightWrong={feedback === 'wrong' && selected ? selected : undefined}
        />
      </div>
    </div>
  );
}
