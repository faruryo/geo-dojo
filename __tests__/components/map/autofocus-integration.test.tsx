// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MunicipalityMap } from '@/components/map/MunicipalityMap';
import { JapanMap } from '@/components/map/JapanMap';

(globalThis as unknown as Record<string, boolean>).IS_REACT_ACT_ENVIRONMENT = true;

// Mock TopoJSON topology
const mockTopology = {
  type: 'Topology',
  objects: {
    japan: {
      type: 'GeometryCollection',
      geometries: [
        {
          type: 'Polygon',
          arcs: [[0]],
          properties: { code: '13101', nam_ja: '千代田区', pref_ja: '東京都' },
        },
        {
          type: 'Polygon',
          arcs: [[1]],
          properties: { code: '13102', nam_ja: '中央区', pref_ja: '東京都' },
        },
      ],
    },
  },
  arcs: [
    [
      [139.75, 35.68],
      [0.02, 0.0],
      [0.0, 0.02],
      [-0.02, 0.0],
      [0.0, -0.02],
    ],
    [
      [139.77, 35.67],
      [0.02, 0.0],
      [0.0, 0.02],
      [-0.02, 0.0],
      [0.0, -0.02],
    ],
  ],
  transform: { scale: [1, 1], translate: [0, 0] },
};

const mockJapanTopology = {
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
      ],
    },
  },
  arcs: [
    [
      [139.75, 35.68],
      [0.02, 0.0],
      [0.0, 0.02],
      [-0.02, 0.0],
      [0.0, -0.02],
    ],
  ],
  transform: { scale: [1, 1], translate: [0, 0] },
};

let mockMap: {
  fitBounds: ReturnType<typeof vi.fn<(bounds: unknown, padding?: unknown) => void>>;
  getZoom: ReturnType<typeof vi.fn<() => number>>;
  setZoom: ReturnType<typeof vi.fn<(zoom: number) => void>>;
};

let mockDataLayer: {
  addListener: ReturnType<typeof vi.fn>;
  forEach: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  addGeoJson: ReturnType<typeof vi.fn>;
  setStyle: ReturnType<typeof vi.fn>;
  setMap: ReturnType<typeof vi.fn>;
};

let mockIdleListener: ((...args: unknown[]) => void) | null = null;

// Mock @googlemaps/js-api-loader so MunicipalityMap receives mocked Google Maps API
vi.mock('@googlemaps/js-api-loader', () => ({
  setOptions: vi.fn(),
  importLibrary: vi.fn().mockImplementation(() =>
    Promise.resolve({
      Map: function () {
        return mockMap;
      },
      Data: function () {
        return mockDataLayer;
      },
    }),
  ),
}));

describe('Map Autofocus Component Integration (T004 - Mounted Component Testing)', () => {
  let container: HTMLDivElement;
  let root: Root;

  const renderAndSettle = async (element: React.ReactElement) => {
    await act(async () => {
      root.render(element);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = 'mock-key';

    mockMap = {
      fitBounds: vi.fn(),
      getZoom: vi.fn().mockReturnValue(14), // Simulates zoom overshoot (> 12)
      setZoom: vi.fn(),
    };

    mockDataLayer = {
      addListener: vi.fn(),
      forEach: vi.fn((cb: (f: unknown) => void) => {
        const featureObj = {
          getProperty: (key: string) => (key === 'code' ? '13101' : '千代田区'),
          getGeometry: () => ({
            forEachLatLng: (fn: (ll: { lat: number; lng: number }) => void) => {
              fn({ lat: 35.68, lng: 139.75 });
            },
          }),
        };
        cb(featureObj);
      }),
      remove: vi.fn(),
      addGeoJson: vi.fn(),
      setStyle: vi.fn(),
      setMap: vi.fn(),
    };

    mockIdleListener = null;

    class MockLatLngBounds {
      extend = vi.fn();
      isEmpty = vi.fn().mockReturnValue(false);
    }

    (global as unknown as Record<string, unknown>).google = {
      maps: {
        Map: vi.fn().mockImplementation(() => mockMap),
        Data: vi.fn().mockImplementation(() => mockDataLayer),
        LatLngBounds: MockLatLngBounds,
        event: {
          addListenerOnce: vi.fn((_map: unknown, _event: string, callback: (...args: unknown[]) => void) => {
            mockIdleListener = callback;
          }),
        },
      },
    };

    // Global fetch mock returning TopoJSON based on requested URL
    (global as unknown as Record<string, unknown>).fetch = vi.fn().mockImplementation((url: string) => {
      const data = url.includes('japan.topojson') ? mockJapanTopology : mockTopology;
      return Promise.resolve({
        ok: true,
        json: async () => data,
      });
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  describe('Mode D (MunicipalityMap) Real Component Mount & Effect Integration', () => {
    it('executes autofocus effect inside mounted MunicipalityMap on incorrect answer (FR-01.4)', async () => {
      await renderAndSettle(
        React.createElement(MunicipalityMap, {
          prefecture: '東京都',
          onMunicipalityClick: vi.fn(),
          highlightCodes: ['13101'],
          wrongCodes: ['13102'],
          isIncorrect: true,
          qIdx: 0,
        }),
      );

      // Assert mounted component effect triggered fitBounds
      expect(mockMap.fitBounds).toHaveBeenCalled();

      // Trigger idle event callback registered by production effect
      expect(google.maps.event.addListenerOnce).toHaveBeenCalledWith(mockMap, 'idle', expect.any(Function));
      expect(mockIdleListener).not.toBeNull();
      if (mockIdleListener) {
        mockIdleListener();
      }

      // Assert production effect clamped zoom to 12
      expect(mockMap.setZoom).toHaveBeenCalledWith(12);
    });

    it('does NOT trigger extra fitBounds when mounted component receives correct answer (FR-03.1 Scoped Negative Test)', async () => {
      // Step 1: Initial mount (idle question, qIdx = 0)
      await renderAndSettle(
        React.createElement(MunicipalityMap, {
          prefecture: '東京都',
          onMunicipalityClick: vi.fn(),
          isIncorrect: false,
          qIdx: 0,
        }),
      );

      expect(mockMap.fitBounds).toHaveBeenCalled();
      mockMap.fitBounds.mockClear();

      // Step 2: Rerender with correct answer (isIncorrect = false) on same qIdx = 0
      await act(async () => {
        root.render(
          React.createElement(MunicipalityMap, {
            prefecture: '東京都',
            onMunicipalityClick: vi.fn(),
            highlightCodes: ['13101'],
            isIncorrect: false,
            qIdx: 0,
          }),
        );
      });

      // Assert mounted component effect did NOT fire additional fitBounds
      expect(mockMap.fitBounds).not.toHaveBeenCalled();
    });

    it('resets camera framing when mounted component receives updated qIdx (FR-03.2)', async () => {
      // Mount initial question
      await renderAndSettle(
        React.createElement(MunicipalityMap, {
          prefecture: '東京都',
          onMunicipalityClick: vi.fn(),
          isIncorrect: false,
          qIdx: 0,
        }),
      );

      mockMap.fitBounds.mockClear();

      // Rerender with new question index (qIdx = 1)
      await renderAndSettle(
        React.createElement(MunicipalityMap, {
          prefecture: '東京都',
          onMunicipalityClick: vi.fn(),
          isIncorrect: false,
          qIdx: 1,
        }),
      );

      // Assert reset effect inside component was executed for updated qIdx
      expect(mockMap.fitBounds).toHaveBeenCalledTimes(1);
    });
  });

  describe('Mode A (JapanMap) Real Component Mount Integration', () => {
    it('applies autofocus transform on incorrect answer and resets on qIdx change (FR-01.1 & FR-03.2)', async () => {
      // Step 1: Render JapanMap on incorrect feedback
      await renderAndSettle(
        React.createElement(JapanMap, {
          onPrefectureClick: vi.fn(),
          highlightCorrect: '東京都',
          isIncorrect: true,
          qIdx: 0,
        }),
      );

      // Query the inner map transform container div
      const transformContainer = container.querySelector<HTMLDivElement>('div[style*="transform"]');
      expect(transformContainer).not.toBeNull();

      if (transformContainer) {
        // Assert autofocus effect applied a non-default zoom transform (scale > 1) and 500ms transition duration (FR-02.3)
        expect(transformContainer.style.transform).not.toBe('translate(0px, 0px) scale(1)');
        expect(transformContainer.style.transform).toMatch(/scale\((?!1\b)[0-9.]+\)/);
        expect(transformContainer.style.transition).toMatch(/0\.5s/);
      }

      // Step 2: Advance question (qIdx = 1, isIncorrect = false)
      await renderAndSettle(
        React.createElement(JapanMap, {
          onPrefectureClick: vi.fn(),
          isIncorrect: false,
          qIdx: 1,
        }),
      );

      // Assert reset effect inside component restored scale: 1, translate: 0,0
      if (transformContainer) {
        expect(transformContainer.style.transform).toBe('translate(0px, 0px) scale(1)');
      }
    });
  });
});
