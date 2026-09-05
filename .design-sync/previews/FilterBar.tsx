import { FilterBar } from 'geo-dojo';

const frame: React.CSSProperties = { background: '#111111', padding: 16, width: 351 };

export function AllModes() {
  return (
    <div style={frame}>
      <FilterBar mode="all" onModeChange={() => {}} region="全国" onRegionChange={() => {}} />
    </div>
  );
}

export function ModeAOnly() {
  return (
    <div style={frame}>
      <FilterBar mode="A" onModeChange={() => {}} region="関東" onRegionChange={() => {}} />
    </div>
  );
}
