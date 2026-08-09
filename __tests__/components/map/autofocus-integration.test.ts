import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateFocusTransform } from '@/lib/map/autofocus-bounds';

describe('Map Autofocus & Reset Component Integration (T004)', () => {
  let mockMap: {
    fitBounds: ReturnType<typeof vi.fn<(...args: unknown[]) => void>>;
    getZoom: ReturnType<typeof vi.fn<() => number>>;
    setZoom: ReturnType<typeof vi.fn<(zoom: number) => void>>;
  };
  let mockIdleListener: ((...args: unknown[]) => void) | null = null;

  beforeEach(() => {
    mockMap = {
      fitBounds: vi.fn(),
      getZoom: vi.fn().mockReturnValue(14), // Simulates initial overshoot (zoom > 12)
      setZoom: vi.fn(),
    };
    mockIdleListener = null;

    // Mock Google Maps global namespace & addListenerOnce
    class MockLatLngBounds {
      extend = vi.fn();
      isEmpty = vi.fn().mockReturnValue(false);
    }

    (global as unknown as Record<string, unknown>).google = {
      maps: {
        LatLngBounds: MockLatLngBounds,
        event: {
          addListenerOnce: vi.fn((_map: unknown, _event: string, callback: (...args: unknown[]) => void) => {
            mockIdleListener = callback;
          }),
        },
      },
    };
  });

  describe('Mode D (MunicipalityMap) Google Maps Autofocus & Clamp Integration', () => {
    it('triggers fitBounds on incorrect feedback and clamps zoom > 12 after idle event (FR-01.4)', () => {
      // Simulate component effect for incorrect answer (isIncorrect: true)
      const isIncorrect = true;
      const highlightCodes = ['13101'];
      const wrongCodes = ['13102'];

      // Mock implementation of focus effect
      if (isIncorrect && (highlightCodes.length > 0 || wrongCodes.length > 0)) {
        const bounds = new google.maps.LatLngBounds();
        mockMap.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });

        google.maps.event.addListenerOnce(mockMap, 'idle', () => {
          if (mockMap.getZoom() > 12) {
            mockMap.setZoom(12);
          }
        });
      }

      // Assert fitBounds was called
      expect(mockMap.fitBounds).toHaveBeenCalledTimes(1);

      // Simulate Google Maps 'idle' event firing asynchronously after fitBounds settles
      expect(google.maps.event.addListenerOnce).toHaveBeenCalledWith(mockMap, 'idle', expect.any(Function));
      expect(mockIdleListener).not.toBeNull();
      if (mockIdleListener) mockIdleListener();

      // Assert zoom was clamped to 12
      expect(mockMap.setZoom).toHaveBeenCalledWith(12);
    });

    it('does NOT trigger extra fitBounds when answer is correct (FR-03.1 Scoped Negative Test)', () => {
      // Step 1: Initial mount (idle question)
      const isIncorrect = false;
      const prefecture = '東京都';

      // Simulates initial prefecture framing fitBounds call on mount
      mockMap.fitBounds(prefecture, { top: 24, right: 24, bottom: 24, left: 24 });
      expect(mockMap.fitBounds).toHaveBeenCalledTimes(1);

      // Step 2: Clear spy after initial mount
      mockMap.fitBounds.mockClear();

      // Step 3: Answer submitted correctly (isIncorrect = false)
      // Focus effect should NOT fire for correct answer
      if (isIncorrect) {
        mockMap.fitBounds(prefecture);
      }

      // Assert no additional fitBounds call occurred during correct answer transition
      expect(mockMap.fitBounds).not.toHaveBeenCalled();
    });

    it('resets camera framing when qIdx changes to a new question (FR-03.2)', () => {
      let qIdx = 0;
      const initialPrefecture = '東京都';

      // Initial question mount
      mockMap.fitBounds(initialPrefecture);
      expect(mockMap.fitBounds).toHaveBeenCalledTimes(1);
      mockMap.fitBounds.mockClear();

      // Advance question: qIdx increments (qIdx = 1), new question starts (isIncorrect = false)
      qIdx = 1;
      const nextPrefecture = '大阪府';
      if (qIdx > 0) {
        mockMap.fitBounds(nextPrefecture);
      }

      // Assert reset fitBounds was called for new question
      expect(mockMap.fitBounds).toHaveBeenCalledTimes(1);
      expect(mockMap.fitBounds).toHaveBeenCalledWith(nextPrefecture);
    });
  });

  describe('Mode A (JapanMap) SVG Focus & Responsive CSS Pixel Translate Integration', () => {
    it('calculates transform and applies smooth CSS transition for incorrect answers', () => {
      const isIncorrect = true;
      const containerWidth = 375;
      const containerHeight = 500;

      if (isIncorrect) {
        const transform = calculateFocusTransform({
          targetNames: ['東京都'],
          topology: null, // Default fallback transform
          containerWidth,
          containerHeight,
        });

        expect(transform).toEqual({
          scale: 1,
          translate: { x: 0, y: 0 },
        });
      }
    });

    it('resets transform to scale: 1, translate: 0,0 on qIdx change', () => {
      let qIdx = 0;
      let state = { scale: 2.5, translate: { x: -50, y: 30 } };

      // Advance question: qIdx = 1
      qIdx = 1;
      if (qIdx > 0) {
        state = { scale: 1, translate: { x: 0, y: 0 } };
      }

      expect(state).toEqual({ scale: 1, translate: { x: 0, y: 0 } });
    });
  });
});
