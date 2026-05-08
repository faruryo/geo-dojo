'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  createCoordinates,
  type PreparedFeature,
} from '@vnedyalk0v/react19-simple-maps';
import type { Topology } from 'topojson-specification';
import { Plus, Minus, RotateCcw } from 'lucide-react';

interface JapanMapProps {
  onPrefectureClick: (name: string) => void;
  highlightCorrect?: string;
  highlightWrong?: string;
}

export function JapanMap({ onPrefectureClick, highlightCorrect, highlightWrong }: JapanMapProps) {
  const [topology, setTopology] = useState<Topology | null>(null);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startX: number; startY: number; tx: number; ty: number } | null>(null);
  const didDrag = useRef(false);

  useEffect(() => {
    fetch('/japan.topojson').then((r) => r.json()).then(setTopology).catch(console.error);
  }, []);

  function handlePointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    dragState.current = { startX: e.clientX, startY: e.clientY, tx: translate.x, ty: translate.y };
    didDrag.current = false;
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragState.current) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
      didDrag.current = true;
      setTranslate({ x: dragState.current.tx + dx, y: dragState.current.ty + dy });
    }
  }

  function handlePointerUp() {
    dragState.current = null;
    // click イベントが先に発火するよう1フレーム後にリセット
    setTimeout(() => { didDrag.current = false; }, 10);
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    setScale((s) => Math.min(8, Math.max(1, s * (e.deltaY < 0 ? 1.15 : 0.87))));
  }

  function zoomIn()  { setScale((s) => Math.min(8, s * 2)); }
  function zoomOut() { setScale((s) => Math.max(1, s / 2)); }
  function reset()   { setScale(1); setTranslate({ x: 0, y: 0 }); }

  if (!topology) {
    return <div className="w-full aspect-[4/5] bg-muted rounded-xl animate-pulse" />;
  }

  return (
    <div className="relative w-full overflow-hidden rounded-xl">
      <div
        ref={containerRef}
        className="w-full cursor-grab active:cursor-grabbing touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
      >
        <div
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: dragState.current ? 'none' : 'transform 0.15s ease',
          }}
        >
          <ComposableMap
            projection="geoMercator"
            projectionConfig={{ center: createCoordinates(138, 35), scale: 1000 }}
            width={400}
            height={500}
            className="w-full"
          >
            <Geographies geography={topology}>
              {({ geographies }) =>
                (geographies as PreparedFeature[]).map((geo) => {
                  const name = (geo.properties as { nam_ja: string }).nam_ja;
                  const isCorrect = name === highlightCorrect;
                  const isWrong = name === highlightWrong;
                  return (
                    <Geography
                      key={name || geo.rsmKey}
                      geography={geo}
                      onClick={() => { if (!didDrag.current) onPrefectureClick(name); }}
                      style={{
                        default: { fill: isCorrect ? '#4a7c59' : isWrong ? '#ef4444' : '#2a2a2a', stroke: '#444', strokeWidth: 0.5, outline: 'none' },
                        hover:   { fill: isCorrect ? '#4a7c59' : isWrong ? '#ef4444' : '#3a3a3a', stroke: '#555', strokeWidth: 0.5, outline: 'none', cursor: 'pointer' },
                        pressed: { fill: '#2d5a3d', outline: 'none' },
                      }}
                    />
                  );
                })
              }
            </Geographies>
          </ComposableMap>
        </div>
      </div>

      {/* ズームコントロール */}
      <div className="absolute top-2 right-2 flex flex-col gap-1">
        {[{ fn: zoomIn, icon: <Plus size={16} />, label: 'ズームイン' },
          { fn: zoomOut, icon: <Minus size={16} />, label: 'ズームアウト' },
          { fn: reset, icon: <RotateCcw size={14} />, label: 'リセット' }].map(({ fn, icon, label }) => (
          <button
            key={label}
            onClick={fn}
            className="w-9 h-9 rounded-lg bg-background/80 border border-border flex items-center justify-center hover:bg-background transition-colors"
            aria-label={label}
          >
            {icon}
          </button>
        ))}
      </div>
    </div>
  );
}
