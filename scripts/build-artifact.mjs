// Turns the Vite build (dist/) into a page for publishing on claude.ai:
// dist/artifact.html plus the bundled script it loads. The publish step wraps
// the page in its own <!doctype>/<head>/<body>, so this keeps only the title,
// styles, markup and the script tag.
//
//   npm run build && node scripts/build-artifact.mjs

import { readFileSync, writeFileSync } from 'node:fs';

const html = readFileSync('dist/index.html', 'utf8');
const title = /<title>[\s\S]*?<\/title>/.exec(html)[0];
const styles = [...html.matchAll(/<style>[\s\S]*?<\/style>/g)].map((m) => m[0]).join('\n');
const script = /<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/.exec(html);
const body = /<body>([\s\S]*)<\/body>/.exec(html)[1].replace(/<script[\s\S]*?<\/script>/g, '').trim();

const src = script[1].replace(/^\.\//, '');
writeFileSync('dist/artifact.html', `${title}\n${styles}\n${body}\n<script type="module" src="${src}"></script>\n`);
console.log(`wrote dist/artifact.html (loads ${src})`);
