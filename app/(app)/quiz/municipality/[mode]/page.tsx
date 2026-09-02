'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { notFound, useParams, useSearchParams } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useMunicipalityWeakness } from '@/lib/hooks/useMunicipalityWeakness';
import { useMunicipalityMaster } from '@/lib/hooks/useMunicipalityMaster';
import { useMunicipalityClearedCodes } from '@/lib/hooks/useMunicipalityClearedCodes';
import {
  getClearedMunicipalityCodes,
  getMunicipalityWeakness,
} from '@/app/(app)/quiz/municipality/actions';
import { queryKeys } from '@/lib/query-keys';
import { RecommendReplayButton } from '@/components/recommend/recommend-replay-button';
import { buildRecommendAutoStartQuestions, isQueryResultReady } from '@/lib/quiz/recommend-auto-start';
import {
  buildMunicipalityQuestions,
  resolveQuizScope,
  type MunicipalityQuizSettings,
} from '@/lib/quiz/municipality-questions';
import { UpcomingReviewMini } from '@/components/quiz/upcoming-review-mini';
import { QuizRunner } from '@/components/quiz/quiz-runner';
import { SessionCountSelector } from '@/components/quiz/session-count-selector';
import { QuizResultCard } from '@/components/quiz/quiz-result-card';
import { QuizPoolProgress } from '@/components/quiz/quiz-pool-progress';
import { ScopeSelector } from '@/components/quiz/scope-selector';
import { MunicipalityPickerDialog } from '@/components/quiz/municipality-picker-dialog';
import type { Question } from '@/components/quiz/quiz-runner';
import { LAST_SELECTED_MODE_KEY, parseGameMode } from '@/lib/quiz/last-selected-mode';
import {
  startRecommendSession,
  finalizeRecommendSession,
  readActiveRecommendUserId,
} from '@/lib/quiz/recommendation/history-cache';
import { getBrowserUserId } from '@/lib/auth/browser-user';
import {
  buildIdentityCodeMap,
  computePoolStats,
  type MunicipalityWeakness,
} from '@/lib/quiz/sampling';
import {
  type Difficulty,
  type GameMode,
  type Municipality,
  DIFFICULTIES,
  DIFFICULTY_LABEL,
  SESSION_COUNTS,
  filterByDifficulty,
  filterByScope,
  filterTextModeMunicipalities,
  isScopeAvailable,
  parseScopeFromSearchParams,
  sanitizeScope,
  updateSearchParamsWithScope,
  LAST_MODE_D_SCOPE_KEY,
} from '@/lib/quiz/municipality-data';

type Settings = MunicipalityQuizSettings;

interface ResultEntry {
  name: string;
  prefecture: string;
  correct: boolean;
}

type Phase = 'setup' | 'playing' | 'result';

const VALID_MODES = ['A', 'B', 'C', 'D'] as const;
const MODE_LABEL: Record<GameMode, string> = {
  A: 'モードA・逆引き地図',
  B: 'モードB・逆引き4択',
  C: 'モードC・順引き4択',
  D: 'モードD・順引き地図',
};

function getStartLabel({
  isLoading,
  isBlocked,
  modeAvailable,
  hasDifficulties,
  poolSize,
}: {
  isLoading: boolean;
  isBlocked: boolean;
  modeAvailable: boolean;
  hasDifficulties: boolean;
  poolSize: number;
}): string {
  if (isLoading) return 'データ読み込み中...';
  if (isBlocked) return 'データ取得に失敗しました（再試行してください）';
  if (!modeAvailable) return '地域を追加してください';
  if (!hasDifficulties) return '難易度を選択してください';
  if (poolSize === 0) return '該当する市区町村なし — 条件を変更してください';
  return 'スタート';
}

export default function MunicipalityQuizPage() {
  const params = useParams<{ mode: string }>();
  const searchParams = useSearchParams();
  const modeFromUrl = (params.mode ?? '').toUpperCase() as GameMode;
  if (!VALID_MODES.includes(modeFromUrl)) notFound();

  const initDifficulty = searchParams.get('difficulty') as Difficulty | null;
  const initDifficultiesParam = searchParams.get('difficulties');
  const sourceParam = searchParams.get('source');
  const countParam = searchParams.get('count');
  const isRecommendSource = sourceParam === 'recommend';
  const recommendCount = countParam ? (parseInt(countParam, 10) as 10 | 20 | 30) : null;

  const initialScope = useMemo(
    () => parseScopeFromSearchParams(searchParams, modeFromUrl),
    [searchParams, modeFromUrl],
  );

  const initDifficulties: Difficulty[] | null = initDifficultiesParam
    ? (initDifficultiesParam.split(',').filter((d) => DIFFICULTIES.includes(d as Difficulty)) as Difficulty[])
    : initDifficulty && DIFFICULTIES.includes(initDifficulty)
      ? [initDifficulty]
      : null;

  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<Phase>('setup');
  const [settings, setSettings] = useState<Settings>({
    mode: modeFromUrl,
    scope: initialScope,
    count: recommendCount && [10, 20, 30].includes(recommendCount) ? recommendCount : 10,
    unclearedFirst: true,
    weaknessFirst: false,
    difficulties: initDifficulties && initDifficulties.length > 0 ? initDifficulties : ['easy', 'medium'],
  });
  const [questions, setQuestions] = useState<Question[]>([]);
  const [results, setResults] = useState<ResultEntry[]>([]);
  const [isMunicipalityPickerOpen, setIsMunicipalityPickerOpen] = useState(false);

  const {
    data: weaknessData = [],
    isSuccess: weaknessSuccess,
    isFetching: weaknessFetching,
    isPaused: weaknessPaused,
    isError: weaknessError,
    refetch: refetchWeakness,
  } = useMunicipalityWeakness();

  const {
    data: clearedCodesData = [],
    isSuccess: clearedSuccess,
    isFetching: clearedFetching,
    isPaused: clearedPaused,
    isError: clearedError,
    refetch: refetchCleared,
  } = useMunicipalityClearedCodes(modeFromUrl);

  const { data: masterData, isLoading: masterLoading } = useMunicipalityMaster();

  const allMunicipalities: Municipality[] = useMemo(
    () =>
      (masterData ?? []).map((m) => ({
        code: m.code,
        name: m.name,
        prefecture: m.prefecture,
        region: m.region,
        difficulty: m.difficulty as Difficulty,
        kana: m.kana ?? undefined,
      })),
    [masterData],
  );

  const identityCodeMap = useMemo(
    () => buildIdentityCodeMap(allMunicipalities),
    [allMunicipalities],
  );

  const clearedCodesSet = useMemo(() => new Set(clearedCodesData), [clearedCodesData]);

  const weaknessMap = useMemo(
    () =>
      new Map<string, MunicipalityWeakness>(
        weaknessData.map((w) => [
          w.municipalityCode,
          {
            municipalityCode: w.municipalityCode,
            errorRate: w.errorRate,
          },
        ]),
      ),
    [weaknessData],
  );

  // ── Persist valid mode to localStorage ──
  useEffect(() => {
    const validMode = parseGameMode(modeFromUrl);
    if (validMode) {
      try {
        localStorage.setItem(LAST_SELECTED_MODE_KEY, validMode);
      } catch {
        // ignore storage error
      }
    }
  }, [modeFromUrl]);

  // ── Restore Mode D scope from localStorage if not provided in searchParams ──
  useEffect(() => {
    if (
      modeFromUrl === 'D' &&
      searchParams.get('source') !== 'recommend' &&
      !searchParams.get('scope') &&
      !searchParams.get('pref') &&
      !searchParams.get('prefecture') &&
      !searchParams.get('region')
    ) {
      try {
        const saved = localStorage.getItem(LAST_MODE_D_SCOPE_KEY);
        if (saved) {
          const parsed = sanitizeScope(JSON.parse(saved));
          if (parsed) {
            setSettings((s) => ({ ...s, scope: parsed }));
          }
        }
      } catch {
        // ignore storage error
      }
    }
  }, [modeFromUrl, searchParams]);

  // ── Persist Mode D scope to localStorage and sync to URL query string ──
  useEffect(() => {
    if (modeFromUrl === 'D' && settings.scope) {
      try {
        localStorage.setItem(LAST_MODE_D_SCOPE_KEY, JSON.stringify(settings.scope));
      } catch {
        // ignore storage error
      }
      if (typeof window !== 'undefined') {
        const currentUrl = new URL(window.location.href);
        const nextParams = updateSearchParamsWithScope(currentUrl.searchParams, settings.scope);
        const newQuery = nextParams.toString();
        const newSearch = newQuery ? `?${newQuery}` : '';
        if (currentUrl.search !== newSearch) {
          currentUrl.search = newSearch;
          window.history.replaceState(null, '', currentUrl.toString());
        }
      }
    }
  }, [modeFromUrl, settings.scope]);

  // ── Synchronized Exit / Abort Handler ──
  const handleExitToSetup = useCallback(async () => {
    finalizeRecommendSession(readActiveRecommendUserId());
    setPhase('setup');
    void queryClient.invalidateQueries({
      queryKey: queryKeys.municipality.clearedCodes(modeFromUrl),
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.municipality.weakness(),
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.dashboard.all,
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.recommendation.all,
    });
  }, [modeFromUrl, queryClient]);

  // ── Mode D Scoped Municipalities & Pool Progress ──
  const currentScope = useMemo(() => resolveQuizScope(settings), [settings]);

  const filteredPool = useMemo(() => {
    const isTextMode = settings.mode === 'A' || settings.mode === 'B' || settings.mode === 'C';
    const source = isTextMode ? filterTextModeMunicipalities(allMunicipalities) : allMunicipalities;
    const scoped = filterByScope(source, currentScope);
    return filterByDifficulty(scoped, settings.difficulties);
  }, [allMunicipalities, settings.mode, settings.difficulties, currentScope]);

  const poolStats = useMemo(
    () => computePoolStats(filteredPool, settings.mode, clearedCodesSet, identityCodeMap),
    [filteredPool, settings.mode, clearedCodesSet, identityCodeMap],
  );

  const effectivePoolSize = poolStats.totalCount;

  const currentPrefecture = currentScope.prefecture ?? '東京都';
  const prefectureMunicipalities = useMemo(() => {
    return allMunicipalities.filter((m) => m.prefecture === currentPrefecture);
  }, [allMunicipalities, currentPrefecture]);

  const selectedMunicipalityCount = useMemo(() => {
    if (currentScope.type !== 'prefecture') return undefined;
    if (currentScope.selectedCodes === undefined) {
      return prefectureMunicipalities.length;
    }
    const prefCodeSet = new Set(prefectureMunicipalities.map((m) => m.code));
    return currentScope.selectedCodes.filter((c) => prefCodeSet.has(c)).length;
  }, [currentScope, prefectureMunicipalities]);

  // ── Normalize selectedCodes to exclude out-of-prefecture codes once master is loaded ──
  useEffect(() => {
    if (
      currentScope.type === 'prefecture' &&
      currentScope.selectedCodes !== undefined &&
      prefectureMunicipalities.length > 0
    ) {
      const prefCodeSet = new Set(prefectureMunicipalities.map((m) => m.code));
      const filtered = currentScope.selectedCodes.filter((c) => prefCodeSet.has(c));
      if (filtered.length !== currentScope.selectedCodes.length) {
        setSettings((s) => ({
          ...s,
          scope: {
            type: 'prefecture',
            prefecture: currentPrefecture,
            selectedCodes: filtered,
          },
        }));
      }
    }
  }, [currentScope, prefectureMunicipalities]);

  // ── Start ──
  const handleStart = useCallback(async () => {
    const qs = buildMunicipalityQuestions(
      allMunicipalities,
      settings,
      weaknessMap,
      clearedCodesSet,
      identityCodeMap,
    );
    if (qs.length === 0) return;
    setQuestions(qs);
    setResults([]);
    startRecommendSession(await getBrowserUserId(), crypto.randomUUID(), settings.mode);
    setPhase('playing');
  }, [allMunicipalities, settings, weaknessMap, clearedCodesSet, identityCodeMap]);

  const [isReplaying, setIsReplaying] = useState(false);
  const [replayError, setReplayError] = useState<string | null>(null);

  // ── Replay with cache synchronization ──
  const handleReplay = useCallback(async () => {
    if (isReplaying) return;
    setIsReplaying(true);
    setReplayError(null);
    try {
      const [clearedRes, weaknessRes] = await Promise.all([
        queryClient.fetchQuery({
          queryKey: queryKeys.municipality.clearedCodes(modeFromUrl),
          queryFn: () => getClearedMunicipalityCodes(modeFromUrl),
        }),
        queryClient.fetchQuery({
          queryKey: queryKeys.municipality.weakness(),
          queryFn: () => getMunicipalityWeakness(),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.dashboard.all,
        }),
      ]);

      const latestClearedCodesSet = new Set(clearedRes);
      const latestWeaknessMap = new Map<string, MunicipalityWeakness>(
        weaknessRes.map((w) => [
          w.municipalityCode,
          { municipalityCode: w.municipalityCode, errorRate: w.errorRate },
        ]),
      );

      const qs = buildMunicipalityQuestions(
        allMunicipalities,
        settings,
        latestWeaknessMap,
        latestClearedCodesSet,
        identityCodeMap,
      );
      if (qs.length === 0) return;
      setQuestions(qs);
      setResults([]);
      startRecommendSession(await getBrowserUserId(), crypto.randomUUID(), settings.mode);
      setPhase('playing');
    } catch (err) {
      console.error('Failed to refetch mastery data for replay:', err);
      setReplayError('最新データの取得に失敗しました。再試行してください。');
    } finally {
      setIsReplaying(false);
    }
  }, [allMunicipalities, settings, identityCodeMap, modeFromUrl, queryClient, isReplaying]);

  // ── Auto-start when coming from recommend ──
  const autoStarted = useRef(false);
  useEffect(() => {
    const qs = buildRecommendAutoStartQuestions({
      isRecommendSource,
      alreadyStarted: autoStarted.current,
      phase,
      masterReady: !masterLoading && allMunicipalities.length > 0,
      modeAvailable: isScopeAvailable(modeFromUrl, currentScope),
      unclearedFirst: settings.unclearedFirst,
      clearedQuerySettledOk: isQueryResultReady({
        isSuccess: clearedSuccess,
        isFetching: clearedFetching,
        isPaused: clearedPaused,
      }),
      weaknessFirst: settings.weaknessFirst,
      weaknessQuerySettledOk: isQueryResultReady({
        isSuccess: weaknessSuccess,
        isFetching: weaknessFetching,
        isPaused: weaknessPaused,
      }),
      allMunicipalities,
      settings,
      weaknessMap,
      clearedCodes: clearedCodesSet,
      identityCodeMap,
    });
    if (qs.length === 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const userId = await getBrowserUserId();
        if (cancelled) return;
        startRecommendSession(userId, crypto.randomUUID(), settings.mode);
        autoStarted.current = true;
        setQuestions(qs);
        setResults([]);
        setPhase('playing');
      } catch (err) {
        if (!cancelled) {
          console.error('[quiz] recommend auto-start failed', err);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    isRecommendSource,
    masterLoading,
    allMunicipalities,
    modeFromUrl,
    settings,
    currentScope,
    weaknessMap,
    clearedCodesSet,
    identityCodeMap,
    phase,
    clearedSuccess,
    clearedFetching,
    clearedPaused,
    weaknessSuccess,
    weaknessFetching,
    weaknessPaused,
  ]);

  const modeAvailable = isScopeAvailable(modeFromUrl, currentScope);

  const isClearedQueryLoading =
    settings.unclearedFirst &&
    !isQueryResultReady({
      isSuccess: clearedSuccess,
      isFetching: clearedFetching,
      isPaused: clearedPaused,
    }) &&
    !clearedError;
  const isClearedQueryError = settings.unclearedFirst && clearedError;
  const isWeaknessQueryLoading =
    settings.weaknessFirst &&
    !isQueryResultReady({
      isSuccess: weaknessSuccess,
      isFetching: weaknessFetching,
      isPaused: weaknessPaused,
    }) &&
    !weaknessError;
  const isWeaknessQueryError = settings.weaknessFirst && weaknessError;

  const isAnyRequiredQueryLoading =
    masterLoading || allMunicipalities.length === 0 || isClearedQueryLoading || isWeaknessQueryLoading;
  const isAnyRequiredQueryError = isClearedQueryError || isWeaknessQueryError;

  const canStart =
    !isAnyRequiredQueryLoading &&
    !isAnyRequiredQueryError &&
    allMunicipalities.length > 0 &&
    settings.difficulties.length > 0 &&
    effectivePoolSize > 0 &&
    modeAvailable;

  const startLabel = getStartLabel({
    isLoading: isAnyRequiredQueryLoading,
    isBlocked: isAnyRequiredQueryError,
    modeAvailable,
    hasDifficulties: settings.difficulties.length > 0,
    poolSize: effectivePoolSize,
  });

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

        <ScopeSelector
          mode={modeFromUrl}
          scope={currentScope}
          onScopeChange={(newScope) => setSettings((s) => ({ ...s, scope: newScope }))}
          onOpenMunicipalityPicker={() => setIsMunicipalityPickerOpen(true)}
          selectedCount={selectedMunicipalityCount}
          totalPrefectureCount={prefectureMunicipalities.length}
        />
        {!modeAvailable && (
          <p className="text-xs text-yellow-500 -mt-1">
            {MODE_LABEL[modeFromUrl]} は2県以上の地域が必要です。地域を追加してください。
          </p>
        )}

        <MunicipalityPickerDialog
          isOpen={isMunicipalityPickerOpen}
          onOpenChange={setIsMunicipalityPickerOpen}
          prefecture={currentPrefecture}
          municipalities={prefectureMunicipalities}
          selectedCodes={currentScope.selectedCodes}
          onSave={(codes) => {
            setSettings((s) => ({
              ...s,
              scope: {
                type: 'prefecture',
                prefecture: currentPrefecture,
                selectedCodes: codes,
              },
            }));
          }}
          clearedCodesSet={clearedCodesSet}
        />

        <SessionCountSelector
          title="問題数"
          selectedValue={settings.count}
          options={SESSION_COUNTS.map((c) => ({ label: `${c}問`, value: c }))}
          onSelect={(count) => setSettings((s) => ({ ...s, count }))}
        />

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

        {/* 制覇進捗表示 */}
        <QuizPoolProgress
          stats={poolStats}
          isLoading={
            !isQueryResultReady({
              isSuccess: clearedSuccess,
              isFetching: clearedFetching,
              isPaused: clearedPaused,
            }) && !clearedError
          }
          isError={clearedError}
          onRetry={() => void refetchCleared()}
        />

        <div className="flex flex-col gap-2.5 pt-1">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.unclearedFirst}
              onChange={(e) => setSettings((s) => ({ ...s, unclearedFirst: e.target.checked }))}
              className="w-4 h-4"
            />
            <span className="text-sm">未クリア優先出題</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.weaknessFirst}
              onChange={(e) => setSettings((s) => ({ ...s, weaknessFirst: e.target.checked }))}
              className="w-4 h-4"
            />
            <span className="text-sm">苦手優先モード</span>
          </label>
        </div>

        {weaknessError && settings.weaknessFirst && (
          <p className="text-xs text-destructive">
            苦手データの読み込みに失敗しました。
            <button
              type="button"
              onClick={() => void refetchWeakness()}
              className="underline font-medium ml-1"
            >
              再試行
            </button>
          </p>
        )}

        <Button onClick={handleStart} disabled={!canStart} className="w-full">
          {startLabel}
        </Button>
        {effectivePoolSize > 0 && effectivePoolSize < settings.count && canStart && (
          <p className="text-xs text-yellow-500 text-center">
            該当 {effectivePoolSize} 件のみ — 全 {effectivePoolSize} 問で出題されます
          </p>
        )}
      </div>
    );
  }

  // ─── Render: Result ─────────────────────────────────────────────

  if (phase === 'result') {
    const correct = results.filter((r) => r.correct).length;
    const wrongItems = results
      .filter((r) => !r.correct)
      .map((r) => ({ name: r.name, detail: r.prefecture }));

    const actions = (
      <>
        {replayError && (
          <p className="text-xs text-destructive text-center mb-1">{replayError}</p>
        )}
        {isRecommendSource ? (
          <>
            <RecommendReplayButton />
            <Button
              onClick={handleReplay}
              disabled={isReplaying}
              variant="outline"
              className="w-full"
            >
              {isReplaying ? '読み込み中...' : '同じ設定でもう一度'}
            </Button>
            <Button onClick={handleExitToSetup} variant="outline" className="w-full">
              設定に戻る
            </Button>
          </>
        ) : (
          <>
            <Button onClick={handleReplay} disabled={isReplaying} className="w-full">
              {isReplaying ? '読み込み中...' : 'もう一度'}
            </Button>
            <Link href="/?recommend=open">
              <Button className="w-full" variant="outline">
                ✨ 今日のおすすめクイズを試す
              </Button>
            </Link>
            <Button onClick={handleExitToSetup} variant="outline" className="w-full">
              設定に戻る
            </Button>
          </>
        )}
      </>
    );

    return (
      <QuizResultCard
        correctCount={correct}
        totalCount={results.length}
        backHref={`/quiz/municipality?mode=${modeFromUrl}`}
        backLabel="モード選択に戻る"
        weakItems={wrongItems}
        weakTitle="苦手な市区町村："
        actions={actions}
      >
        <UpcomingReviewMini days={7} />
      </QuizResultCard>
    );
  }

  // ─── Render: Playing ────────────────────────────────────────────

  return (
    <QuizRunner
      questions={questions}
      allMunicipalities={allMunicipalities}
      onAbort={handleExitToSetup}
      onComplete={(completedResults) => {
        finalizeRecommendSession(readActiveRecommendUserId());
        setResults(completedResults);
        setPhase('result');
        void queryClient.invalidateQueries({
          queryKey: queryKeys.municipality.clearedCodes(modeFromUrl),
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.municipality.weakness(),
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.dashboard.all,
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.recommendation.all,
        });
      }}
    />
  );
}
