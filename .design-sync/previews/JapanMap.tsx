import { JapanMap } from 'geo-dojo';
import { serveTopology } from './_topology';

serveTopology();

const frame: React.CSSProperties = { background: '#111111', width: 340, height: 425 };

export function Default() {
  return (
    <div style={frame}>
      <JapanMap onPrefectureClick={() => {}} />
    </div>
  );
}

export function Selected() {
  return (
    <div style={frame}>
      <JapanMap onPrefectureClick={() => {}} selectedNames={['東京都', '広島県']} />
    </div>
  );
}

export function Answered() {
  return (
    <div style={frame}>
      <JapanMap onPrefectureClick={() => {}} highlightCorrect={['山形県']} highlightWrong="秋田県" />
    </div>
  );
}
