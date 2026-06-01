'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMunicipalityMaster } from '@/lib/hooks/useMunicipalityMaster';
import { getDueReviewItems } from './actions';
import { QuizRunner } from '@/components/quiz/quiz-runner';
import type { Question } from '@/components/quiz/quiz-runner';
import {
  type Difficulty,
  type Municipality,
  ALL_PREFECTURES,
  getRegionsPrefectures,
  shuffle,
} from '@/lib/quiz/municipality-data';

interface ResultEntry {
  name: string;
  prefecture: string;
  correct: boolean;
}

type Phase = 'loading' | 'empty' | 'playing' | 'result';

export default function ReviewPage() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [results, setResults] = useState<ResultEntry[]>([]);

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

  useEffect(() => {
    if (masterLoading || allMunicipalities.length === 0) return;

    getDueReviewItems({ limit: 20 })
      .then((items) => {
        if (items.length === 0) {
          setPhase('empty');
          return;
        }

        // モード混在 Question[] を組み立てる（出題順は期日優先順のまま）
        const seenInSession = new Set<string>();
        const qs: Question[] = [];

        // Mode A: 同じ name を持つ due コードをグルーピング
        const modeAItems = items.filter((it) => it.mode === 'A');
        const modeAByName = new Map<string, typeof modeAItems>();
        for (const it of modeAItems) {
          const instances = allMunicipalities.filter((m) => m.code === it.municipalityCode);
          const name = instances[0]?.name ?? it.municipalityName;
          if (!modeAByName.has(name)) modeAByName.set(name, []);
          modeAByName.get(name)!.push(it);
        }
        const modeANames = new Set<string>();

        for (const it of items) {
          const sessionKey = `${it.municipalityCode}::${it.mode}`;
          if (seenInSession.has(sessionKey)) continue;
          seenInSession.add(sessionKey);

          if (it.mode === 'A') {
            const instances = allMunicipalities.filter((m) => m.code === it.municipalityCode);
            const name = instances[0]?.name ?? it.municipalityName;
            if (modeANames.has(name)) continue;
            modeANames.add(name);
            const allInstances = allMunicipalities.filter((m) => m.name === name);
            qs.push({
              kind: 'A',
              name,
              instances: allInstances,
              correctPrefectures: new Set(allInstances.map((m) => m.prefecture)),
            });
          } else {
            const municipality = allMunicipalities.find((m) => m.code === it.municipalityCode);
            if (!municipality) continue;

            const mode = it.mode as 'B' | 'C' | 'D';
            if (mode === 'B') {
              const prefPool = ALL_PREFECTURES;
              const distractors = shuffle(prefPool.filter((p) => p !== municipality.prefecture)).slice(0, 3);
              const choices = shuffle([municipality.prefecture, ...distractors]);
              qs.push({ kind: 'BCD', mode: 'B', municipality, choices });
            } else {
              // Mode C/D
              const regionPrefs = getRegionsPrefectures([municipality.region as import('@/lib/quiz/municipality-data').Region]);
              const useRegion = regionPrefs.length >= 4;
              const namesInTargetPref = new Set(
                allMunicipalities.filter((a) => a.prefecture === municipality.prefecture).map((a) => a.name),
              );
              const regionPrefSet = new Set(regionPrefs);
              const distractorPool = new Map<string, Municipality>();
              for (const c of allMunicipalities) {
                if (c.prefecture === municipality.prefecture) continue;
                if (useRegion && !regionPrefSet.has(c.prefecture)) continue;
                if (namesInTargetPref.has(c.name)) continue;
                if (distractorPool.has(c.name)) continue;
                distractorPool.set(c.name, c);
              }
              const distractors = shuffle([...distractorPool.values()]).slice(0, 3).map((d) => d.name);
              const choices = shuffle([municipality.name, ...distractors]);
              qs.push({ kind: 'BCD', mode, municipality, choices });
            }
          }
        }

        if (qs.length === 0) {
          setPhase('empty');
          return;
        }

        setQuestions(qs);
        setPhase('playing');
      })
      .catch(() => setPhase('empty'));
  }, [masterLoading, allMunicipalities]);

  // ─── Loading ──────────────────────────────────────────────────────

  if (phase === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 min-h-[50vh]">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-sm text-muted-foreground">復習問題を読み込み中...</p>
      </div>
    );
  }

  // ─── Empty ────────────────────────────────────────────────────────

  if (phase === 'empty') {
    return (
      <div className="flex flex-col gap-5 p-4 max-w-md mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={14} />
          ダッシュボードに戻る
        </Link>
        <div className="text-center py-10">
          <p className="text-4xl mb-3">🎉</p>
          <h2 className="text-xl font-semibold mb-2">今日の復習はありません</h2>
          <p className="text-sm text-muted-foreground">
            次の復習期日になったらまた挑戦しましょう。
          </p>
        </div>
        <Link href="/">
          <Button className="w-full" variant="outline">ダッシュボードへ</Button>
        </Link>
      </div>
    );
  }

  // ─── Result ───────────────────────────────────────────────────────

  if (phase === 'result') {
    const correct = results.filter((r) => r.correct).length;
    const wrong = results.filter((r) => !r.correct);
    const accuracy = results.length > 0 ? Math.round((correct / results.length) * 100) : 0;

    return (
      <div className="flex flex-col gap-4 p-4 max-w-md mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={14} />
          ダッシュボードに戻る
        </Link>
        <h2 className="text-xl font-semibold text-center">復習完了</h2>
        <div className="text-center text-4xl font-bold text-primary">
          {correct} / {results.length}
        </div>
        <p className="text-center text-muted-foreground text-sm">正答率 {accuracy}%</p>

        {wrong.length > 0 && (
          <div className="rounded-xl bg-card p-4">
            <p className="text-sm font-medium mb-2">まだ苦手な市区町村：</p>
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

        <Link href="/">
          <Button className="w-full">ダッシュボードへ</Button>
        </Link>
      </div>
    );
  }

  // ─── Playing ──────────────────────────────────────────────────────

  return (
    <QuizRunner
      questions={questions}
      allMunicipalities={allMunicipalities}
      onAbort={() => setPhase('empty')}
      onComplete={(completedResults) => {
        setResults(completedResults);
        setPhase('result');
      }}
    />
  );
}
