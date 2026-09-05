import { ModeAView } from 'geo-dojo';
import { serveTopology } from './_topology';

serveTopology();

const frame: React.CSSProperties = { background: '#111111', width: 340, height: 500, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 };

export function Answering() {
  return (
    <div style={frame}>
      <ModeAView
        qIdx={0}
        correctPrefectures={new Set(['東京都', '広島県'])}
        selectedPrefectures={new Set(['東京都'])}
        feedback="idle"
        onPrefectureTap={() => {}}
        onSubmit={() => {}}
      />
    </div>
  );
}

export function Answered() {
  return (
    <div style={frame}>
      <ModeAView
        qIdx={1}
        correctPrefectures={new Set(['東京都', '広島県'])}
        selectedPrefectures={new Set(['東京都', '広島県'])}
        feedback="correct"
        onPrefectureTap={() => {}}
        onSubmit={() => {}}
      />
    </div>
  );
}
