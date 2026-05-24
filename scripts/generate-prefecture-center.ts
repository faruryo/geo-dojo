import * as fs from 'fs';
import * as path from 'path';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import { geoBounds, geoCentroid } from 'd3-geo';

const topoPath = path.join(process.cwd(), 'public', 'japan-municipalities.topojson');
const topology = JSON.parse(fs.readFileSync(topoPath, 'utf-8')) as Topology;
const objKey = Object.keys(topology.objects)[0];

const geojson = feature(topology, topology.objects[objKey] as Parameters<typeof feature>[1]) as GeoJSON.FeatureCollection;

const byPrefecture: Record<string, GeoJSON.Feature[]> = {};
for (const f of geojson.features) {
  const pref = (f.properties as Record<string, string>)?.pref_ja;
  if (!pref) continue;
  (byPrefecture[pref] ||= []).push(f);
}

const result: Record<string, { center: [number, number]; scale: number }> = {};
for (const [pref, feats] of Object.entries(byPrefecture)) {
  const fc: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: feats };
  const [[w, s], [e, n]] = geoBounds(fc);
  const center = geoCentroid(fc) as [number, number];
  const span = Math.max(e - w, (n - s) * 1.4);
  const scale = Math.round(8000 / span);
  result[pref] = { center, scale };
}

const outPath = path.join(process.cwd(), 'lib', 'quiz', 'prefecture-center.ts');
fs.writeFileSync(
  outPath,
  `export const prefectureCenter: Record<string, { center: [number, number]; scale: number }> = ${JSON.stringify(result, null, 2)} as const;\n`,
);
console.log(`Generated ${Object.keys(result).length} prefecture centers → ${outPath}`);
