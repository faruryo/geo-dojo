import { SessionCountSelector } from 'geo-dojo';

const frame: React.CSSProperties = { background: '#111111', padding: 16, width: 351 };
const options = [
  { label: '10問', value: 10 },
  { label: '20問', value: 20 },
  { label: '全問', value: 'all' },
];

export function Default() {
  return (
    <div style={frame}>
      <SessionCountSelector options={options} selectedValue={10} onSelect={() => {}} />
    </div>
  );
}

export function AllSelected() {
  return (
    <div style={frame}>
      <SessionCountSelector options={options} selectedValue="all" onSelect={() => {}} title="出題数を選ぶ" />
    </div>
  );
}
