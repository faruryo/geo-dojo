'use client';

import { useEffect, useState } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  createCoordinates,
  type PreparedFeature,
} from '@vnedyalk0v/react19-simple-maps';
import type { Topology } from 'topojson-specification';

interface MiniJapanMapProps {
  highlight?: string;
  showZoomFrame?: boolean;
}

// Pure render-only Japan map for previews. No pan/zoom/click — just a 白地図.
export function MiniJapanMap({ highlight, showZoomFrame }: MiniJapanMapProps) {
  const [topology, setTopology] = useState<Topology | null>(null);

  useEffect(() => {
    fetch('/japan.topojson').then((r) => r.json()).then(setTopology).catch(console.error);
  }, []);

  if (!topology) {
    return <div className="w-full h-full bg-muted/30 rounded-xl animate-pulse" />;
  }

  return (
    <div className="relative w-full h-full pointer-events-none">
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
              const isHighlighted = name === highlight;
              return (
                <Geography
                  key={name || geo.rsmKey}
                  geography={geo}
                  style={{
                    default: {
                      fill: isHighlighted ? '#4a7c59' : '#e5e7eb',
                      stroke: '#9ca3af',
                      strokeWidth: 0.4,
                      outline: 'none',
                    },
                    hover: { fill: isHighlighted ? '#4a7c59' : '#e5e7eb', outline: 'none' },
                    pressed: { outline: 'none' },
                  }}
                />
              );
            })
          }
        </Geographies>
      </ComposableMap>
      {showZoomFrame && highlight && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="rounded-full bg-background/80 border border-primary px-2.5 py-1 text-[10px] font-medium text-primary shadow-sm">
            🔍 {highlight} を拡大
          </div>
        </div>
      )}
    </div>
  );
}
