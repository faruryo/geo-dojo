import { EmptyState } from 'geo-dojo';

const frame: React.CSSProperties = { background: '#111111', padding: 16, width: 351 };

export function Default() {
  return (
    <div style={frame}>
      <EmptyState message="まだ解答の記録がありません" />
    </div>
  );
}

export function CustomLink() {
  return (
    <div style={frame}>
      <EmptyState message="復習できる問題がまだありません" linkText="都道府県クイズへ" linkHref="/quiz/prefecture" />
    </div>
  );
}
