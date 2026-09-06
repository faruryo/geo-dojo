import { describe, it, expect } from 'vitest';
import { geoMercator } from 'd3-geo';
import {
  JAPAN_PROJECTION_CENTER,
  JAPAN_PROJECTION_SCALE,
  JAPAN_VIEWBOX_HEIGHT,
  JAPAN_VIEWBOX_WIDTH,
} from '@/lib/map/japan-projection';

/**
 * public/japan.topojson から算出した、47都道府県の本体ポリゴンの外形が収まる範囲。
 * 最西と最南は沖縄県（沖縄本島）、最東と最北は北海道（本島）。
 */
const MAIN_BODY_BOUNDS = {
  west: 127.64,
  east: 145.81,
  south: 26.07,
  north: 45.52,
} as const;

function project() {
  return geoMercator()
    .center([...JAPAN_PROJECTION_CENTER] as [number, number])
    .scale(JAPAN_PROJECTION_SCALE)
    .translate([JAPAN_VIEWBOX_WIDTH / 2, JAPAN_VIEWBOX_HEIGHT / 2]);
}

describe('全国地図の投影', () => {
  it('47都道府県の本体がすべて viewBox に収まる', () => {
    const p = project();
    const corners: Array<[number, number]> = [
      [MAIN_BODY_BOUNDS.west, MAIN_BODY_BOUNDS.north],
      [MAIN_BODY_BOUNDS.east, MAIN_BODY_BOUNDS.north],
      [MAIN_BODY_BOUNDS.west, MAIN_BODY_BOUNDS.south],
      [MAIN_BODY_BOUNDS.east, MAIN_BODY_BOUNDS.south],
    ];

    for (const corner of corners) {
      const point = p(corner);
      expect(point).not.toBeNull();
      const [x, y] = point as [number, number];
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(JAPAN_VIEWBOX_WIDTH);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(JAPAN_VIEWBOX_HEIGHT);
    }
  });

  it('縦画面を活かすため viewBox が縦長である', () => {
    expect(JAPAN_VIEWBOX_HEIGHT).toBeGreaterThan(JAPAN_VIEWBOX_WIDTH);
  });

  it('余白を詰めてあり、本体の外形が viewBox の 9 割以上を占める', () => {
    const p = project();
    const [xw] = p([MAIN_BODY_BOUNDS.west, MAIN_BODY_BOUNDS.south]) as [number, number];
    const [xe] = p([MAIN_BODY_BOUNDS.east, MAIN_BODY_BOUNDS.south]) as [number, number];
    const [, yn] = p([MAIN_BODY_BOUNDS.west, MAIN_BODY_BOUNDS.north]) as [number, number];
    const [, ys] = p([MAIN_BODY_BOUNDS.west, MAIN_BODY_BOUNDS.south]) as [number, number];

    expect((xe - xw) / JAPAN_VIEWBOX_WIDTH).toBeGreaterThan(0.9);
    expect((ys - yn) / JAPAN_VIEWBOX_HEIGHT).toBeGreaterThan(0.9);
  });
});
