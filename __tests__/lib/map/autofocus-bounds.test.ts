import { describe, it, expect } from 'vitest';
import { mergeBounds, calculateFocusTransform } from '@/lib/map/autofocus-bounds';
import type { Topology } from 'topojson-specification';

describe('autofocus-bounds', () => {
  describe('mergeBounds', () => {
    it('returns null for empty coordinate array', () => {
      expect(mergeBounds([])).toBeNull();
    });

    it('calculates bounding box for multiple coordinates', () => {
      const points: Array<[number, number]> = [
        [135.0, 34.0],
        [136.5, 35.5],
        [134.8, 34.2],
      ];
      const bounds = mergeBounds(points);
      expect(bounds).toEqual({
        minLng: 134.8,
        minLat: 34.0,
        maxLng: 136.5,
        maxLat: 35.5,
      });
    });

    it('handles single coordinate point correctly', () => {
      const points: Array<[number, number]> = [[139.6917, 35.6895]];
      const bounds = mergeBounds(points);
      expect(bounds).toEqual({
        minLng: 139.6917,
        minLat: 35.6895,
        maxLng: 139.6917,
        maxLat: 35.6895,
      });
    });
  });

  describe('calculateFocusTransform', () => {
    // Minimal mock TopoJSON Topology for testing
    const mockTopology: Topology = {
      type: 'Topology',
      objects: {
        japan: {
          type: 'GeometryCollection',
          geometries: [
            {
              type: 'Polygon',
              arcs: [[0]],
              properties: { nam_ja: '東京都' },
            },
            {
              type: 'Polygon',
              arcs: [[1]],
              properties: { nam_ja: '神奈川県' },
            },
          ],
        },
      },
      arcs: [
        // Arc 0: Around Tokyo (approx 139.7, 35.68)
        [
          [139.6, 35.6],
          [0.2, 0.0],
          [0.0, 0.2],
          [-0.2, 0.0],
          [0.0, -0.2],
        ],
        // Arc 1: Around Kanagawa (approx 139.6, 35.45)
        [
          [139.5, 35.3],
          [0.2, 0.0],
          [0.0, 0.3],
          [-0.2, 0.0],
          [0.0, -0.3],
        ],
      ],
      transform: {
        scale: [1, 1],
        translate: [0, 0],
      },
    };

    it('calculates transform with container CSS pixel scale ratio compensation', () => {
      const result = calculateFocusTransform({
        targetNames: ['東京都'],
        topology: mockTopology,
        containerWidth: 375,
        containerHeight: 500,
      });

      expect(result).toBeDefined();
      expect(result.scale).toBeGreaterThanOrEqual(1);
      expect(result.scale).toBeLessThanOrEqual(8);
      expect(typeof result.translate.x).toBe('number');
      expect(typeof result.translate.y).toBe('number');
    });

    it('returns default transform (scale: 1, translate: 0,0) when targetNames is empty or not found', () => {
      const result = calculateFocusTransform({
        targetNames: ['存在しない県'],
        topology: mockTopology,
        containerWidth: 375,
        containerHeight: 500,
      });

      expect(result).toEqual({
        scale: 1,
        translate: { x: 0, y: 0 },
      });
    });
  });
});
