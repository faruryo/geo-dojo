'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { saveMunicipalityQuizResult } from '@/app/(app)/quiz/municipality/actions';
import { dedupeInstancesByPrefecture, type GameMode, type Municipality } from '@/lib/quiz/municipality-data';
import { toQuestionResult } from '@/lib/quiz/quiz-results';

const JapanMap = dynamic(
  () => import('@/components/map/JapanMap').then((m) => m.JapanMap),
  { ssr: false, loading: () => <div className="w-full aspect-square bg-muted rounded-xl animate-pulse" /> },
);
const MunicipalityMap = dynamic(
  () => import('@/components/map/MunicipalityMap').then((m) => m.MunicipalityMap),
  { ssr: false, loading: () => <div className="w-full aspect-square bg-muted rounded-xl animate-pulse" /> },
);

// ─── Types ─────────────────────────────────────────────────────────

export interface ModeAQuestion {
  kind: 'A';
  name: string;
  instances: Municipality[];
  correctPrefectures: Set<string>;
}
export interface SingleQuestion {
  kind: 'BCD';
  mode: 'B' | 'C' | 'D';
  municipality: Municipality;
  choices: string[];
}
export type Question = ModeAQuestion | SingleQuestion;

interface ResultEntry {
  name: string;
  prefecture: string;
  correct: boolean;
}

type FeedbackState = 'idle' | 'correct' | 'incorrect';

const TIME_LIMIT_SEC = 30;

interface QuizRunnerProps {
  questions: Question[];
  allMunicipalities: Municipality[];
  onAbort: () => void;
  onComplete: (results: ResultEntry[]) => void;
}

// ─── Component ─────────────────────────────────────────────────────

export function QuizRunner({ questions, allMunicipalities, onAbort, onComplete }: QuizRunnerProps) {
  const [qIdx, setQIdx] = useState(0);
  const [feedback, setFeedback] = useState<FeedbackState>('idle');
  const [results, setResults] = useState<ResultEntry[]>([]);
  const [modeDFailed, setModeDFailed] = useState(false);
  const [selectedPrefectures, setSelectedPrefectures] = useState<Set<string>>(new Set());
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [correctCodes, setCorrectCodes] = useState<string[]>([]);
  const [wrongCodes, setWrongCodes] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT_SEC);
  const completedRef = useRef(false);

  const currentQuestion = questions[qIdx] ?? null;

  // ── Advance to next question ──
  const advanceQuestion = useCallback((updatedResults: ResultEntry[]) => {
    setFeedback('idle');
    setSelectedPrefectures(new Set());
    setSelectedChoice(null);
    setCorrectCodes([]);
    setWrongCodes([]);
    setModeDFailed(false);
    const nextIdx = qIdx + 1;
    if (nextIdx >= questions.length) {
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete(updatedResults);
      }
    } else {
      setQIdx(nextIdx);
    }
  }, [qIdx, questions.length, onComplete]);

  // ── Save result + advance ──
  // delayMs: フィードバック表示時間。A/D は地図確認のため長め(1500)、B/C は短め(1200)。
  const recordAndAdvance = useCallback(
    async (entries: { municipality: Municipality; isCorrect: boolean; mode: GameMode }[], delayMs: number) => {
      // 1回の呼び出し = 1問。保存件数で数えると複数県の同名市が二重カウントされ
      // 「19問なのに21完了」になるため、表示用の結果は toQuestionResult で1問1件に正規化する。
      const updatedResults = [...results, toQuestionResult(entries)];
      setResults(updatedResults);
      const saved = await Promise.allSettled(
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
      // 保存失敗は UX を止めないが握り潰すと今回のような本番障害に気付けないため必ずログする
      saved.forEach((r, i) => {
        if (r.status === 'rejected') {
          console.error('[quiz-runner] failed to save result', {
            code: entries[i].municipality.code,
            mode: entries[i].mode,
            reason: r.reason,
          });
        }
      });
      setTimeout(() => advanceQuestion(updatedResults), delayMs);
    },
    [results, advanceQuestion],
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
    // B007: 政令市は同名の区が複数コードで存在するため、都道府県ごとに代表1件へ畳んで
    // 記録する（区数ぶんの多重カウントを防ぐ）。採点は correctPrefectures（県の Set）で実施済み。
    const reps = dedupeInstancesByPrefecture(instances);
    await recordAndAdvance(
      reps.map((m) => ({ municipality: m, isCorrect: correct, mode: 'A' as GameMode })),
      1500,
    );
  }, [currentQuestion, selectedPrefectures, recordAndAdvance]);

  // ── Mode B: prefecture choice ──
  const handleBChoice = useCallback(
    async (choice: string) => {
      if (feedback !== 'idle' || !currentQuestion || currentQuestion.kind !== 'BCD') return;
      const { municipality } = currentQuestion;
      const correct = choice === municipality.prefecture;
      setSelectedChoice(choice);
      setFeedback(correct ? 'correct' : 'incorrect');
      await recordAndAdvance([{ municipality, isCorrect: correct, mode: 'B' }], 1200);
    },
    [feedback, currentQuestion, recordAndAdvance],
  );

  // ── Mode C: municipality choice ──
  const handleCChoice = useCallback(
    async (choice: string) => {
      if (feedback !== 'idle' || !currentQuestion || currentQuestion.kind !== 'BCD') return;
      const { municipality } = currentQuestion;
      const correct = choice === municipality.name;
      setSelectedChoice(choice);
      setFeedback(correct ? 'correct' : 'incorrect');
      await recordAndAdvance([{ municipality, isCorrect: correct, mode: 'C' }], 1200);
    },
    [feedback, currentQuestion, recordAndAdvance],
  );

  // ── Mode D: municipality map tap ──
  const handleDTap = useCallback(
    async (code: string, tappedName: string) => {
      if (feedback !== 'idle' || !currentQuestion || currentQuestion.kind !== 'BCD') return;
      const { municipality } = currentQuestion;
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
      await recordAndAdvance([{ municipality, isCorrect: correct, mode: 'D' }], 1500);
    },
    [feedback, currentQuestion, allMunicipalities, recordAndAdvance],
  );

  const handleModeDFallback = useCallback(() => setModeDFailed(true), []);

  // ── Timeout: mode D ──
  const handleTimeout = useCallback(async () => {
    if (feedback !== 'idle' || !currentQuestion) return;
    if (currentQuestion.kind === 'BCD' && currentQuestion.mode === 'D' && !modeDFailed) {
      const { municipality } = currentQuestion;
      const allCorrectCodes = allMunicipalities
        .filter((m) => m.name === municipality.name && m.prefecture === municipality.prefecture)
        .map((m) => m.code);
      setCorrectCodes(allCorrectCodes);
      setFeedback('incorrect');
      await recordAndAdvance([{ municipality, isCorrect: false, mode: 'D' }], 1500);
    }
  }, [feedback, currentQuestion, modeDFailed, allMunicipalities, recordAndAdvance]);

  // ── Countdown for mode D ──
  useEffect(() => {
    if (feedback !== 'idle' || !currentQuestion) return;
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
  }, [feedback, qIdx, currentQuestion, modeDFailed, handleTimeout]);

  if (!currentQuestion) return null;

  const progressText = `${qIdx + 1} / ${questions.length}`;
  const correctCount = results.filter((r) => r.correct).length;

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

  const abortButton = (
    <button
      onClick={onAbort}
      className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
    >
      <ChevronLeft size={14} />
      中断
    </button>
  );

  // ── Mode A ──
  if (currentQuestion.kind === 'A') {
    const { name, correctPrefectures } = currentQuestion;
    const remaining = correctPrefectures.size - selectedPrefectures.size;
    const canSubmit = remaining === 0 && feedback === 'idle';

    return (
      <div className="flex flex-col h-full gap-2 p-3 max-w-4xl mx-auto">
        <div className="flex items-center justify-between text-xs text-muted-foreground shrink-0">
          {abortButton}
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
  const effectiveMode = mode === 'D' && modeDFailed ? 'C' : mode;

  return (
    <div className="flex flex-col h-full gap-2 p-3 max-w-4xl mx-auto">
      <div className="flex items-center justify-between text-xs text-muted-foreground shrink-0">
        {abortButton}
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
