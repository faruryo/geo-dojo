'use client';

import { formatModeAFeedback, withKana } from '@/lib/quiz/feedback-labels';
import { locationLabel } from '@/lib/quiz/location-labels';
import type { Municipality } from '@/lib/quiz/municipality-data';
import type {
  FeedbackState,
  ModeAQuestion,
  Question,
  SingleQuestion,
} from '../use-quiz-session';
// 定義元から直接取る。use-quiz-session 越しだと保存系の server action まで芋づるで付いてくる。
import { TIME_LIMIT_SEC } from '../use-quiz-timer';
import { ModeAView } from '../views/mode-a-view';
import { MunicipalityMapView } from '../views/municipality-map-view';
import { BottomHud, type BottomHudContent } from './bottom-hud';
import { QuestionIntro } from './question-intro';
import { TopHud, type HudTimer } from './top-hud';
import {
  introEmphasis,
  introRestoreMs,
  showsIntroOverlay,
  type QuestionIntro as QuestionIntroState,
} from './use-question-intro';

/**
 * 地図問題を含むセッションの出題画面。
 *
 * 地図コンテナを上下の帯のあいだに閉じ込めるのが要。こうすると Google のロゴが帯の
 * 直上に可視のまま残り、不正解後の自動フォーカスが読む矩形も自動的に帯の内側になる。
 * 高さを自前で計算すると、帯の高さが変わったときに両方が同時に壊れる。
 */

type QuizSessionValue = {
  readonly qIdx: number;
  readonly currentQuestion: Question | null;
  readonly feedback: FeedbackState;
  readonly modeDFailed: boolean;
  readonly selectedPrefectures: ReadonlySet<string>;
  readonly selectedChoice: string | null;
  readonly correctCodes: readonly string[];
  readonly wrongCodes: readonly string[];
  readonly timeLeft: number;
  readonly handlePrefectureTap: (name: string) => void;
  readonly handleModeASubmit: () => void;
  readonly handleChoice: (choice: string, mode: 'B' | 'C') => void;
  readonly handleDTap: (code: string, name: string) => void;
  readonly handleModeDFallback: () => void;
  readonly intro: QuestionIntroState;
};

/** 単問モードの識別子。フォールバック後の実効モードもこの型で扱う。 */
type SingleMode = 'B' | 'C' | 'D';

interface ImmersiveQuizViewProps {
  readonly questions: readonly Question[];
  readonly session: QuizSessionValue;
  readonly onAbort: () => void;
}

function effectiveModeOf(question: SingleQuestion, modeDFailed: boolean): SingleMode {
  return question.mode === 'D' && modeDFailed ? 'C' : question.mode;
}

function submitLabel(remaining: number, canSubmit: boolean, feedback: FeedbackState): string {
  if (feedback !== 'idle') return '次へ...';
  if (canSubmit) return '解答する';
  return `あと ${remaining} か所`;
}

function modeAContent(question: ModeAQuestion, feedback: FeedbackState): BottomHudContent {
  if (feedback === 'idle') return { kind: 'prompt', title: question.name };
  return {
    kind: 'feedback',
    correct: feedback === 'correct',
    detail: formatModeAFeedback(question.name, question.instances),
  };
}

function singleTitle(question: SingleQuestion, effectiveMode: SingleMode): string {
  const { municipality, mode } = question;
  if (mode === 'B') return municipality.name;
  if (effectiveMode === 'D') return locationLabel(municipality.code, municipality.name);
  return municipality.prefecture;
}

function singleDetail(question: SingleQuestion, effectiveMode: SingleMode): string {
  const { municipality, mode } = question;
  if (mode === 'B') {
    return `${withKana(municipality.name, municipality.kana)} （正解: ${municipality.prefecture}）`;
  }
  const displayName =
    effectiveMode === 'D'
      ? locationLabel(municipality.code, municipality.name)
      : municipality.name;
  return withKana(displayName, municipality.kana);
}

function singleContent(
  question: SingleQuestion,
  effectiveMode: SingleMode,
  feedback: FeedbackState,
): BottomHudContent {
  if (feedback !== 'idle') {
    return {
      kind: 'feedback',
      correct: feedback === 'correct',
      detail: singleDetail(question, effectiveMode),
    };
  }
  return {
    kind: 'prompt',
    title: singleTitle(question, effectiveMode),
    subTitle: effectiveMode === 'D' ? `（${question.municipality.prefecture}）` : undefined,
  };
}

function correctChoiceOf(municipality: Municipality, mode: SingleMode): string {
  return mode === 'B' ? municipality.prefecture : municipality.name;
}

function emphasisOf(intro: QuestionIntroState, content: BottomHudContent) {
  return introEmphasis(intro, content.kind === 'prompt');
}

function restoreMsOf(intro: QuestionIntroState, content: BottomHudContent) {
  return introRestoreMs(intro, content.kind === 'prompt');
}

function IntroOverlay({
  intro,
  content,
}: Readonly<{ intro: QuestionIntroState; content: BottomHudContent }>) {
  if (!showsIntroOverlay(intro, content.kind === 'prompt') || content.kind !== 'prompt') return null;
  return (
    <QuestionIntro
      phase={intro.phase}
      transitionMs={intro.plan.transitionMs}
      title={content.title}
      subTitle={content.subTitle}
    />
  );
}

function Stage({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="relative min-h-0 flex-1">{children}</div>;
}

function FallbackNotice() {
  return (
    <div className="flex h-full w-full items-center justify-center px-6">
      <p className="text-center text-xs text-[#fafafa]/70">
        地図データの読み込みに失敗しました（4択で代替表示）
      </p>
    </div>
  );
}

function ModeAStageAndHud({
  question,
  session,
  questionCount,
  onAbort,
}: Readonly<{
  question: ModeAQuestion;
  session: QuizSessionValue;
  questionCount: number;
  onAbort: () => void;
}>) {
  const { qIdx, feedback, selectedPrefectures, handlePrefectureTap, handleModeASubmit, intro } = session;
  const remaining = question.correctPrefectures.size - selectedPrefectures.size;
  const canSubmit = remaining === 0 && feedback === 'idle';
  const content = modeAContent(question, feedback);

  return (
    <>
      <TopHud currentIndex={qIdx} totalQuestions={questionCount} onAbort={onAbort} />
      <Stage>
        <ModeAView
          qIdx={qIdx}
          correctPrefectures={question.correctPrefectures}
          selectedPrefectures={selectedPrefectures}
          feedback={feedback}
          onPrefectureTap={handlePrefectureTap}
        />
      </Stage>
      <IntroOverlay intro={intro} content={content} />
      <BottomHud
        content={content}
        mode="A"
        selectedCount={feedback === 'idle' ? selectedPrefectures.size : undefined}
        onRequestIntro={intro.requestIntro}
        emphasis={emphasisOf(intro, content)}
        restoreMs={restoreMsOf(intro, content)}
        submit={{
          label: submitLabel(remaining, canSubmit, feedback),
          disabled: !canSubmit,
          onSubmit: handleModeASubmit,
        }}
      />
    </>
  );
}

function SingleStage({
  question,
  session,
  isMap,
}: Readonly<{ question: SingleQuestion; session: QuizSessionValue; isMap: boolean }>) {
  const { qIdx, feedback, modeDFailed, correctCodes, wrongCodes, handleDTap, handleModeDFallback } =
    session;
  if (!isMap) return modeDFailed ? <FallbackNotice /> : null;
  return (
    <MunicipalityMapView
      prefecture={question.municipality.prefecture}
      qIdx={qIdx}
      correctCodes={correctCodes}
      wrongCodes={wrongCodes}
      feedback={feedback}
      onMunicipalityClick={handleDTap}
      onLoadError={handleModeDFallback}
    />
  );
}

function SingleStageAndHud({
  question,
  session,
  questionCount,
  onAbort,
}: Readonly<{
  question: SingleQuestion;
  session: QuizSessionValue;
  questionCount: number;
  onAbort: () => void;
}>) {
  const { qIdx, feedback, modeDFailed, timeLeft, selectedChoice, handleChoice, intro } = session;
  const effectiveMode = effectiveModeOf(question, modeDFailed);
  const content = singleContent(question, effectiveMode, feedback);
  const isMap = effectiveMode === 'D';
  const timer: HudTimer | undefined = isMap
    ? { kind: 'countdown', secondsLeft: timeLeft, totalSeconds: TIME_LIMIT_SEC }
    : undefined;

  return (
    <>
      <TopHud
        currentIndex={qIdx}
        totalQuestions={questionCount}
        onAbort={onAbort}
        timer={timer}
      />
      <Stage>
        <SingleStage
          question={question}
          session={session}
          isMap={isMap}
        />
      </Stage>
      <IntroOverlay intro={intro} content={content} />
      <BottomHud
        content={content}
        mode="BCD"
        onRequestIntro={intro.requestIntro}
        emphasis={emphasisOf(intro, content)}
        restoreMs={restoreMsOf(intro, content)}
        choices={
          isMap
            ? undefined
            : {
                items: question.choices,
                selected: selectedChoice,
                correct: correctChoiceOf(question.municipality, question.mode),
                feedback,
                onSelect: (c) => handleChoice(c, question.mode === 'B' ? 'B' : 'C'),
              }
        }
      />
    </>
  );
}

export function ImmersiveQuizView({
  questions,
  session,
  onAbort,
}: Readonly<ImmersiveQuizViewProps>) {
  const { currentQuestion } = session;
  if (!currentQuestion) return null;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-[#111111]">
      {currentQuestion.kind === 'A' ? (
        <ModeAStageAndHud
          question={currentQuestion}
          session={session}
          questionCount={questions.length}
          onAbort={onAbort}
        />
      ) : (
        <SingleStageAndHud
          question={currentQuestion}
          session={session}
          questionCount={questions.length}
          onAbort={onAbort}
        />
      )}
    </div>
  );
}
