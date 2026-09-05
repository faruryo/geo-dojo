import { QuizResultCard } from 'geo-dojo';

const frame: React.CSSProperties = { background: '#111111', padding: 12, width: 351 };

const action = (
  <div style={{ minHeight: 44, borderRadius: 10, background: '#fafafa', color: '#171717', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    もう一度
  </div>
);

export function Perfect() {
  return (
    <div style={frame}>
      <QuizResultCard correctCount={10} totalCount={10} backHref="/quiz" backLabel="クイズ選択に戻る" actions={action} />
    </div>
  );
}

export function WithWeakItems() {
  return (
    <div style={frame}>
      <QuizResultCard
        correctCount={7}
        totalCount={10}
        backHref="/quiz"
        backLabel="クイズ選択に戻る"
        weakTitle="苦手な市区町村："
        weakItems={[
          { name: '府中市', detail: 'ふちゅうし' },
          { name: '伊達市', detail: 'だてし' },
          { name: '川崎町', detail: 'かわさきまち' },
        ]}
        actions={action}
      />
    </div>
  );
}
