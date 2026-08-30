import { describe, expect, it } from 'vitest';
import { mergeMunicipalityFeaturesByCode } from '@/lib/map/merge-municipality-features';

function poly(code: string, nam_ja: string): GeoJSON.Feature {
  return {
    type: 'Feature',
    properties: { code, nam_ja, pref_ja: '北海道' },
    geometry: {
      type: 'Polygon',
      coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
    },
  };
}

describe('mergeMunicipalityFeaturesByCode', () => {
  it('does not merge different codes that share nam_ja', () => {
    const merged = mergeMunicipalityFeaturesByCode([
      poly('01101', '札幌市'),
      poly('01102', '札幌市'),
    ]);
    expect(merged).toHaveLength(2);
    expect(merged.map((f) => String(f.properties?.code ?? ''))).toEqual(
      expect.arrayContaining(['01101', '01102']),
    );
  });

  it('keeps a single feature for a unique code', () => {
    const merged = mergeMunicipalityFeaturesByCode([poly('01202', '函館市')]);
    expect(merged).toHaveLength(1);
  });
});
