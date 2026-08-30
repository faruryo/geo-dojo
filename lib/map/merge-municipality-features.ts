import { union } from '@turf/union';

function featureCode(f: GeoJSON.Feature): string {
  const raw: unknown = f.properties;
  if (!raw || typeof raw !== 'object') return '';
  if (!('code' in raw)) return '';
  const code = raw.code;
  return typeof code === 'string' ? code : '';
}

/** Merge split polygons of the same municipality code. Do not merge different codes that share nam_ja. */
export function mergeMunicipalityFeaturesByCode(
  features: readonly GeoJSON.Feature[],
): GeoJSON.Feature[] {
  const byCode = new Map<string, GeoJSON.Feature[]>();
  for (const f of features) {
    const code = featureCode(f);
    const list = byCode.get(code) ?? [];
    list.push(f);
    byCode.set(code, list);
  }

  const merged: GeoJSON.Feature[] = [];
  for (const group of byCode.values()) {
    const first = group[0];
    if (!first) continue;
    if (group.length === 1) {
      merged.push(first);
      continue;
    }
    try {
      const valid = group.filter((f) => f.geometry != null);
      if (valid.length === 0) {
        merged.push(first);
        continue;
      }
      const fc: GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon> = {
        type: 'FeatureCollection',
        features: valid.filter(
          (f): f is GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> =>
            f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon',
        ),
      };
      const dissolved = union(fc);
      if (dissolved) {
        dissolved.properties = first.properties;
        merged.push(dissolved);
      } else {
        merged.push(first);
      }
    } catch {
      merged.push(first);
    }
  }
  return merged;
}
