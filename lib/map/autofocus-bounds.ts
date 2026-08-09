import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import { geoMercator } from 'd3-geo';

export interface GeoBounds {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

export interface FocusTransformResult {
  scale: number;
  translate: { x: number; y: number };
}

export interface CalculateFocusTransformOptions {
  targetNames: string[];
  topology: Topology | null;
  containerWidth: number;
  containerHeight: number;
  viewBoxWidth?: number;
  viewBoxHeight?: number;
  projectionCenter?: [number, number];
  projectionScale?: number;
}

export function mergeBounds(points: Array<[number, number]>): GeoBounds | null {
  if (!points || points.length === 0) return null;

  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  for (const [lng, lat] of points) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  if (minLng === Infinity || minLat === Infinity) return null;

  return { minLng, minLat, maxLng, maxLat };
}

function getMatchedFeatures(topology: Topology, targetNames: string[]): GeoJSON.Feature[] {
  const targetObj = Object.values(topology.objects)[0];
  if (!targetObj) return [];

  try {
    const geoData = feature(topology, targetObj as GeometryCollection);
    if (geoData && 'type' in geoData && geoData.type === 'FeatureCollection') {
      const targetSet = new Set(targetNames);
      return geoData.features.filter((f) => {
        const props = f.properties as Record<string, string> | null;
        const name = props?.nam_ja;
        return name ? targetSet.has(name) : false;
      });
    }
    return [];
  } catch {
    return [];
  }
}

interface SvgBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function updateBoundsWithPoint(bounds: SvgBounds, px: number, py: number): void {
  if (px < bounds.minX) bounds.minX = px;
  if (px > bounds.maxX) bounds.maxX = px;
  if (py < bounds.minY) bounds.minY = py;
  if (py > bounds.maxY) bounds.maxY = py;
}

function extractProjectedBounds(
  features: GeoJSON.Feature[],
  projection: ReturnType<typeof geoMercator>,
): SvgBounds | null {
  const bounds: SvgBounds = {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
  };

  const processCoords = (coords: unknown) => {
    if (!Array.isArray(coords)) return;

    const first: unknown = coords[0];
    const second: unknown = coords[1];
    if (typeof first === 'number' && typeof second === 'number') {
      const projected = projection([first, second]);
      if (projected) {
        updateBoundsWithPoint(bounds, projected[0], projected[1]);
      }
    } else {
      for (const item of coords) {
        processCoords(item);
      }
    }
  };

  for (const f of features) {
    if (f.geometry) {
      processCoords((f.geometry as GeoJSON.Geometry & { coordinates: unknown }).coordinates);
    }
  }

  if (bounds.minX === Infinity || bounds.minY === Infinity) {
    return null;
  }

  return bounds;
}

export function calculateFocusTransform({
  targetNames,
  topology,
  containerWidth,
  containerHeight,
  viewBoxWidth = 400,
  viewBoxHeight = 500,
  projectionCenter = [138, 35],
  projectionScale = 1000,
}: CalculateFocusTransformOptions): FocusTransformResult {
  const defaultResult: FocusTransformResult = { scale: 1, translate: { x: 0, y: 0 } };

  if (!topology || !targetNames || targetNames.length === 0) return defaultResult;

  const matchedFeatures = getMatchedFeatures(topology, targetNames);
  if (matchedFeatures.length === 0) return defaultResult;

  const projection = geoMercator()
    .center(projectionCenter)
    .scale(projectionScale)
    .translate([viewBoxWidth / 2, viewBoxHeight / 2]);

  const bounds = extractProjectedBounds(matchedFeatures, projection);
  if (!bounds) return defaultResult;

  const dx = bounds.maxX - bounds.minX;
  const dy = bounds.maxY - bounds.minY;
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;

  const rawScale = Math.min(
    viewBoxWidth / (dx > 0 ? dx : 20),
    viewBoxHeight / (dy > 0 ? dy : 20),
  ) * 0.7;

  const targetScale = Math.min(8, Math.max(1, rawScale));
  const svgContentScale = Math.min(containerWidth / viewBoxWidth, containerHeight / viewBoxHeight);

  return {
    scale: targetScale,
    translate: {
      x: (viewBoxWidth / 2 - cx) * svgContentScale * targetScale,
      y: (viewBoxHeight / 2 - cy) * svgContentScale * targetScale,
    },
  };
}
