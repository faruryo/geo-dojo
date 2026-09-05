import { QuizHeader } from 'geo-dojo';

const frame: React.CSSProperties = { background: '#111111', padding: 12, width: 351 };

export function Default() {
  return (
    <div style={frame}>
      <QuizHeader currentIndex={2} totalQuestions={10} correctCount={2} onAbort={() => {}} />
    </div>
  );
}

export function FinalQuestion() {
  return (
    <div style={frame}>
      <QuizHeader currentIndex={9} totalQuestions={10} correctCount={7} onAbort={() => {}} />
    </div>
  );
}
