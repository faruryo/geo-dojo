// Compiles app/globals.css (Tailwind v4) into .design-sync/tailwind.css for the
// design-sync bundle, then promotes the .dark token block onto :root — the app
// hardcodes class "dark" on <html>, which preview cards don't have.
// Run from the repo root:  node .design-sync/build-css.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';

const OUT = '.design-sync/tailwind.css';
execFileSync('./.ds-sync/node_modules/.bin/tailwindcss', ['-i', 'app/globals.css', '-o', OUT], { stdio: 'inherit' });

const src = readFileSync('app/globals.css', 'utf8');
const start = src.indexOf('.dark {');
if (start === -1) throw new Error('no .dark block in app/globals.css');
let depth = 0, end = start;
for (let i = src.indexOf('{', start); i < src.length; i++) {
  if (src[i] === '{') depth++;
  else if (src[i] === '}' && --depth === 0) { end = i; break; }
}
const body = src.slice(src.indexOf('{', start) + 1, end);
appendFileSync(OUT, `\n/* design-sync: geo-dojo renders dark-by-default (class "dark" on <html>) */\n:root {${body}}\nhtml, body { background: var(--background); color: var(--foreground); }\n`);
writeFileSync(OUT, readFileSync(OUT, 'utf8'));
console.log('appended dark tokens to', OUT);
