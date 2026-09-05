// The map components fetch '/japan.topojson' at runtime. Preview cards are
// served from the design project, where that path does not exist, so the map
// renders empty. Serve the real file (41 KB) from an inlined copy instead.
import topology from './japan-topology.json';

let patched = false;
export function serveTopology() {
  if (patched || typeof window === 'undefined') return;
  patched = true;
  const original = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : String((input as Request).url ?? input);
    if (url.includes('japan.topojson')) {
      return Promise.resolve(
        new Response(JSON.stringify(topology), { headers: { 'content-type': 'application/json' } }),
      );
    }
    return original(input as RequestInfo, init);
  }) as typeof window.fetch;
}
