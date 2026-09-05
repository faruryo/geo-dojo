import { ChoiceView } from 'geo-dojo';

const frame: React.CSSProperties = { background: '#111111', padding: 12, width: 351 };
const choices = ['山形県', '秋田県', '新潟県', '福島県'];

export function Asking() {
  return (
    <div style={frame}>
      <ChoiceView choices={choices} selectedChoice={null} correctChoice="山形県" feedback="idle" onSelectChoice={() => {}} />
    </div>
  );
}

export function Correct() {
  return (
    <div style={frame}>
      <ChoiceView choices={choices} selectedChoice="山形県" correctChoice="山形県" feedback="correct" onSelectChoice={() => {}} />
    </div>
  );
}

export function Incorrect() {
  return (
    <div style={frame}>
      <ChoiceView choices={choices} selectedChoice="秋田県" correctChoice="山形県" feedback="incorrect" onSelectChoice={() => {}} />
    </div>
  );
}
