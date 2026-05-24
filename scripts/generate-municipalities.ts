import * as fs from 'fs';
import * as path from 'path';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import { PREFECTURE_TO_REGION } from '../lib/quiz/municipality-data';

const topoPath = path.join(process.cwd(), 'public', 'japan-municipalities.topojson');
const topology = JSON.parse(fs.readFileSync(topoPath, 'utf-8')) as Topology;
const objKey = Object.keys(topology.objects)[0];

const geojson = feature(topology, topology.objects[objKey] as Parameters<typeof feature>[1]) as GeoJSON.FeatureCollection;
const seen = new Set<string>();
const municipalities: Array<{ code: string; name: string; prefecture: string; region: string }> = [];

for (const f of geojson.features) {
  const code = (f.properties as Record<string, string>)?.code;
  if (!code || seen.has(code)) continue;
  seen.add(code);
  const name = (f.properties as Record<string, string>)?.nam_ja ?? '';
  const prefecture = (f.properties as Record<string, string>)?.pref_ja ?? '';
  const region = PREFECTURE_TO_REGION[prefecture] ?? '不明';
  municipalities.push({ code, name, prefecture, region });
}

municipalities.sort((a, b) => a.code.localeCompare(b.code));

const outPath = path.join(process.cwd(), 'public', 'municipalities.json');
fs.writeFileSync(outPath, JSON.stringify(municipalities));
const sizeKB = (fs.statSync(outPath).size / 1024).toFixed(1);
console.log(`Generated ${municipalities.length} municipalities → ${outPath} (${sizeKB} KB)`);
