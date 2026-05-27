'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import { union } from '@turf/union';
import { prefectureCenter } from '@/lib/quiz/prefecture-center';

const GEO_URL = '/japan-municipalities.topojson';

interface MunicipalityMapProps {
  prefecture: string;
  onMunicipalityClick: (code: string, name: string) => void;
  highlightCodes?: string[];
  wrongCodes?: string[];
  onLoadError?: () => void;
}

let mapsLibraryPromise: Promise<google.maps.MapsLibrary> | null = null;
let topologyPromise: Promise<Topology> | null = null;

function getMapsLibrary(): Promise<google.maps.MapsLibrary> {
  if (mapsLibraryPromise) return mapsLibraryPromise;
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return Promise.reject(new Error('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set'));
  }
  setOptions({ key: apiKey, v: 'weekly' });
  mapsLibraryPromise = importLibrary('maps');
  return mapsLibraryPromise;
}

function getTopology(): Promise<Topology> {
  if (topologyPromise) return topologyPromise;
  topologyPromise = fetch(GEO_URL).then((r) => {
    if (!r.ok) throw new Error('Failed to load municipality map data');
    return r.json();
  });
  return topologyPromise;
}

export function MunicipalityMap({
  prefecture,
  onMunicipalityClick,
  highlightCodes = [],
  wrongCodes = [],
  onLoadError,
}: MunicipalityMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const dataLayerRef = useRef<google.maps.Data | null>(null);
  const clickListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const clickHandlerRef = useRef(onMunicipalityClick);
  const [ready, setReady] = useState(false);

  // Keep latest click handler in a ref so the map listener (registered once)
  // always calls the current closure without re-binding on every render.
  useEffect(() => {
    clickHandlerRef.current = onMunicipalityClick;
  }, [onMunicipalityClick]);

  // ── Initialize map + load + render features for prefecture ──
  useEffect(() => {
    let cancelled = false;
    const center = prefectureCenter[prefecture] ?? { center: [136, 36] as [number, number], scale: 2000 };

    // Google calls this global on auth failure (invalid key, referrer block,
    // Maps JS API not enabled). Wire it to onLoadError so the page falls back
    // to mode C instead of showing the in-canvas "エラーが発生しました" overlay.
    (window as unknown as { gm_authFailure?: () => void }).gm_authFailure = () => {
      if (!cancelled) onLoadError?.();
    };

    (async () => {
      try {
        const [maps, topology] = await Promise.all([getMapsLibrary(), getTopology()]);
        if (cancelled || !containerRef.current) return;

        // Initialize map once
        if (!mapRef.current) {
          mapRef.current = new maps.Map(containerRef.current, {
            center: { lat: center.center[1], lng: center.center[0] },
            zoom: 9,
            mapTypeId: 'roadmap',
            disableDefaultUI: false,
            zoomControl: true,
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false,
            gestureHandling: 'greedy',
            clickableIcons: false,
          });

          dataLayerRef.current = new maps.Data({ map: mapRef.current });
          clickListenerRef.current = dataLayerRef.current.addListener(
            'click',
            (e: google.maps.Data.MouseEvent) => {
              const code = e.feature.getProperty('code') as string | undefined;
              const name = e.feature.getProperty('nam_ja') as string | undefined;
              if (code && name) clickHandlerRef.current(code, name);
            },
          );
        }

        // Replace features for the current prefecture
        const data = dataLayerRef.current!;
        data.forEach((f) => data.remove(f));

        const objKey = Object.keys(topology.objects)[0];
        const fc = feature(topology, topology.objects[objKey] as GeometryCollection) as GeoJSON.FeatureCollection;
        const prefFeatures = fc.features.filter(
          (f) => (f.properties as Record<string, string> | null)?.pref_ja === prefecture,
        );

        // Merge all geometries that share the same display name (nam_ja) into one
        // MultiPolygon. This handles two cases:
        //   1. Same code split across multiple polygons (e.g. 高岡市 — islands/enclaves)
        //   2. Same city name across different ward codes (e.g. 名古屋市 has 16 wards,
        //      each with a distinct code but identical nam_ja — merging them shows the
        //      whole city as one clickable area instead of confusing ward boundaries)
        const byName = new Map<string, GeoJSON.Feature[]>();
        for (const f of prefFeatures) {
          const name = (f.properties as Record<string, string> | null)?.nam_ja ?? '';
          if (!byName.has(name)) byName.set(name, []);
          byName.get(name)!.push(f);
        }
        const mergedFeatures: GeoJSON.Feature[] = [];
        byName.forEach((group) => {
          if (group.length === 1) {
            mergedFeatures.push(group[0]);
          } else {
            // Union-dissolve ward polygons so internal shared boundaries are removed.
            // Without this, adjacent ward polygons each draw their shared edge and
            // the internal ward grid is visible even though the city is one tap target.
            try {
              const valid = group.filter((f) => f.geometry != null);
              if (valid.length === 0) { mergedFeatures.push(group[0]); return; }
              const fc: GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon> = {
                type: 'FeatureCollection',
                features: valid as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>[],
              };
              const dissolved = union(fc);
              if (dissolved) {
                dissolved.properties = group[0].properties;
                mergedFeatures.push(dissolved);
              } else {
                mergedFeatures.push(group[0]);
              }
            } catch {
              mergedFeatures.push(group[0]);
            }
          }
        });
        data.addGeoJson({ type: 'FeatureCollection', features: mergedFeatures }, { idPropertyName: 'code' });

        // Fit map to features so different-sized prefectures all frame nicely.
        // LatLngBounds lives in the 'core' library; google.maps namespace is
        // populated once any library is loaded, so accessing it globally is safe here.
        const bounds = new google.maps.LatLngBounds();
        data.forEach((f) => {
          f.getGeometry()?.forEachLatLng((ll) => bounds.extend(ll));
        });
        if (!bounds.isEmpty()) {
          mapRef.current.fitBounds(bounds, { top: 24, right: 24, bottom: 24, left: 24 });
        }

        setReady(true);
      } catch (err) {
        console.error('MunicipalityMap load error:', err);
        if (!cancelled) onLoadError?.();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [prefecture, onLoadError]);

  // ── Apply dynamic styling whenever highlight/wrong sets change ──
  const applyStyle = useCallback(() => {
    const data = dataLayerRef.current;
    if (!data) return;
    const highlightSet = new Set(highlightCodes);
    const wrongSet = new Set(wrongCodes);
    data.setStyle((f) => {
      const code = f.getProperty('code') as string | undefined;
      const isCorrect = code ? highlightSet.has(code) : false;
      const isWrong = code ? wrongSet.has(code) : false;
      const fillColor = isCorrect ? '#22c55e' : isWrong ? '#ef4444' : '#3b82f6';
      const fillOpacity = isCorrect || isWrong ? 0.55 : 0.15;
      return {
        fillColor,
        fillOpacity,
        strokeColor: isCorrect ? '#16a34a' : isWrong ? '#dc2626' : '#1d4ed8',
        strokeWeight: 1.2,
        clickable: true,
        cursor: 'pointer',
      };
    });
  }, [highlightCodes, wrongCodes]);

  useEffect(() => {
    if (ready) applyStyle();
  }, [ready, applyStyle]);

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      if (clickListenerRef.current) {
        clickListenerRef.current.remove();
        clickListenerRef.current = null;
      }
      if (dataLayerRef.current) {
        dataLayerRef.current.setMap(null);
        dataLayerRef.current = null;
      }
      mapRef.current = null;
    };
  }, []);

  return <div ref={containerRef} className="w-full h-full rounded-xl overflow-hidden" />;
}
