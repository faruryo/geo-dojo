import { QuizQuestionCard } from 'geo-dojo';

const frame: React.CSSProperties = { background: '#111111', padding: 12, width: 351, display: 'flex', flexDirection: 'column', gap: 8 };

export function Asking() {
  return (
    <div style={frame}>
      <QuizQuestionCard
        promptText="この市区町村がある都道府県を地図でタップ"
        title="府中市"
        subTitle="2 か所あります"
        difficulty="hard"
        feedback="idle"
      />
    </div>
  );
}

export function Correct() {
  return (
    <div style={frame}>
      <QuizQuestionCard
        promptText="この市区町村を地図でタップ"
        title="鶴岡市"
        subTitle="（山形県）"
        difficulty="medium"
        feedback="correct"
        feedbackDetail="つるおかし（山形県）"
      />
    </div>
  );
}

export function Incorrect() {
  return (
    <div style={frame}>
      <QuizQuestionCard
        promptText="この市区町村がある都道府県を地図でタップ"
        title="府中市"
        difficulty="expert"
        feedback="incorrect"
        feedbackDetail="ふちゅうし（東京都・広島県）"
      />
    </div>
  );
}
