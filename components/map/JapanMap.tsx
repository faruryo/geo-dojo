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
  highlightCorrect?: string | string[];
  highlightWrong?: string;
  selectedNames?: string[];
}

export function JapanMap({ onPrefectureClick, highlightCorrect, highlightWrong, selectedNames }: JapanMapProps) {
  const correctSet = new Set(
    Array.isArray(highlightCorrect) ? highlightCorrect : highlightCorrect ? [highlightCorrect] : [],
  );
  const selectedSet = new Set(selectedNames ?? []);
  const [topology, setTopology] = useState<Topology | null>(null);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startX: number; startY: number; tx: number; ty: number } | null>(null);
  // タッチ端末の2本指ピンチ用。touch-none でブラウザ標準ズームを殺しているので
  // PointerEvent を pointerId ごとに追跡して自前でピンチズーム/パンする（B009）
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchState = useRef<{
    startDist: number;
    startScale: number;
    startMid: { x: number; y: number };
    startTranslate: { x: number; y: number };
  } | null>(null);
  const didDrag = useRef(false);

  useEffect(() => {
    fetch('/japan.topojson').then((r) => r.json()).then(setTopology).catch(console.error);
  }, []);

  function midpointOf(points: { x: number; y: number }[]) {
    const [p1, p2] = points;
    return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  }

  // 現在のポインタ位置と表示状態を基準にピンチ追跡を開始/再開する。
  // 指の本数が増減したら毎回呼び直し、基準ズレによる表示ジャンプを防ぐ
  function startPinch() {
    const pts = [...pointers.current.values()];
    pinchState.current = {
      startDist: Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y),
      startScale: scale,
      startMid: midpointOf(pts),
      startTranslate: translate,
    };
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size >= 2) {
      startPinch();
      dragState.current = null;
      didDrag.current = true; // ピンチ中〜直後の click で誤選択させない
    } else {
      dragState.current = { startX: e.clientX, startY: e.clientY, tx: translate.x, ty: translate.y };
      didDrag.current = false;
    }
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pinchState.current && pointers.current.size >= 2) {
      const ps = pinchState.current;
      const pts = [...pointers.current.values()];
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const rect = containerRef.current?.getBoundingClientRect();
      if (dist === 0 || ps.startDist === 0 || !rect) return;

      const newScale = Math.min(8, Math.max(1, ps.startScale * (dist / ps.startDist)));
      // transformOrigin が中央固定なので、指の中点を不動点に保つよう translate を補正する。
      // 画面座標: screen = center + translate + scale * (content - center) より
      //   t1 = (mid1 - c) - (s1 / s0) * ((mid0 - c) - t0)
      const ratio = newScale / ps.startScale;
      const c = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      const mid = midpointOf(pts);
      setScale(newScale);
      setTranslate({
        x: mid.x - c.x - ratio * (ps.startMid.x - c.x - ps.startTranslate.x),
        y: mid.y - c.y - ratio * (ps.startMid.y - c.y - ps.startTranslate.y),
      });
      return;
    }

    if (!dragState.current) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
      didDrag.current = true;
      setTranslate({ x: dragState.current.tx + dx, y: dragState.current.ty + dy });
    }
  }

  function handlePointerUp(e: React.PointerEvent) {
    // タッチは up の後に leave も届くため、未追跡ポインタの重複処理を弾く
    if (!pointers.current.delete(e.pointerId)) return;
    if (pointers.current.size >= 2) {
      // 3本→2本などに減ってもピンチ継続（基準を再設定して飛びを防ぐ）
      startPinch();
    } else if (pointers.current.size === 1) {
      pinchState.current = null;
      // ピンチから片指に戻ったらドラッグパンとして継続（基準を再設定して飛びを防ぐ）
      const [p] = [...pointers.current.values()];
      dragState.current = { startX: p.x, startY: p.y, tx: translate.x, ty: translate.y };
    } else {
      pinchState.current = null;
      dragState.current = null;
      // click イベントが先に発火するよう1フレーム後にリセット
      setTimeout(() => { didDrag.current = false; }, 10);
    }
  }

  // タッチは pointerdown 時の暗黙キャプチャで領域外でも up/cancel が届くが、
  // マウスはキャプチャなし（click の retarget を避けるため）なので leave で後始末する
  function handlePointerLeave(e: React.PointerEvent) {
    if (e.pointerType === 'mouse') handlePointerUp(e);
  }

  // Native wheel listener with { passive: false } — React's onWheel is passive
  // by default and silently ignores preventDefault(), letting the page scroll.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      setScale((s) => Math.min(8, Math.max(1, s * (e.deltaY < 0 ? 1.15 : 0.87))));
    }
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [topology]);

  function zoomIn()  { setScale((s) => Math.min(8, s * 2)); }
  function zoomOut() { setScale((s) => Math.max(1, s / 2)); }
  function reset()   { setScale(1); setTranslate({ x: 0, y: 0 }); }

  if (!topology) {
    return <div className="w-full h-full bg-muted rounded-xl animate-pulse" />;
  }

  return (
    <div className="relative w-full h-full overflow-hidden rounded-xl">
      <div
        ref={containerRef}
        className="w-full h-full cursor-grab active:cursor-grabbing touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerLeave}
      >
        <div
          className="w-full h-full"
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: dragState.current || pinchState.current ? 'none' : 'transform 0.15s ease',
          }}
        >
          <ComposableMap
            projection="geoMercator"
            projectionConfig={{ center: createCoordinates(138, 35), scale: 1000 }}
            width={400}
            height={500}
            className="w-full h-full"
          >
            <Geographies geography={topology}>
              {({ geographies }) =>
                (geographies as PreparedFeature[]).map((geo) => {
                  const name = (geo.properties as { nam_ja: string }).nam_ja;
                  const isCorrect = correctSet.has(name);
                  const isWrong = name === highlightWrong;
                  const isSelected = selectedSet.has(name);
                  const baseFill = isCorrect ? '#4a7c59' : isWrong ? '#ef4444' : isSelected ? '#3b82f6' : '#2a2a2a';
                  const hoverFill = isCorrect ? '#4a7c59' : isWrong ? '#ef4444' : isSelected ? '#60a5fa' : '#3a3a3a';
                  return (
                    <Geography
                      key={name || geo.rsmKey}
                      geography={geo}
                      onClick={() => { if (!didDrag.current) onPrefectureClick(name); }}
                      style={{
                        default: { fill: baseFill, stroke: '#444', strokeWidth: 0.5, outline: 'none' },
                        hover:   { fill: hoverFill, stroke: '#555', strokeWidth: 0.5, outline: 'none', cursor: 'pointer' },
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
