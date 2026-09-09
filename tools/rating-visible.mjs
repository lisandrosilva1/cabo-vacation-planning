/**
 * Show the rating this page already claims.
 * -------------------------------------------------------------------------
 * The page declares an `aggregateRating` of 5.0 from 86 reviews in its JSON-LD
 * and shows the reader nothing. Google asks for marked-up ratings to be visible,
 * and — more to the point — a score that exists only in markup is
 * indistinguishable from an invented one, whether or not it is real.
 *
 * Ours is real: it is the Google Business profile "Private Chef los Cabos",
 * verified on 2026-09-08. So the honest fix is to show it and link to the
 * profile it comes from, not to delete it.
 *
 *   node tools/rating-visible.mjs
 *
 * Numbers come from the page's own JSON-LD, never retyped here, and the script
 * refuses to write if the result would still be invisible.
 */
import fs from 'node:fs';
import path from 'node:path';

/** The profile the score comes from. `search.google.com/local/reviews` 404s. */
const PROFILE = 'https://maps.google.com/?cid=3201305924429296605';

const FILE = path.resolve('index.html');
let html = fs.readFileSync(FILE, 'utf8');

const visibleText = (h) =>
  h
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');

const rating = html.match(
  /"aggregateRating"\s*:\s*\{[^}]*"ratingValue"\s*:\s*"?([\d.]+)"?/,
);
const count = html.match(/"(?:reviewCount|ratingCount)"\s*:\s*"?(\d+)"?/);
if (!rating || !count) {
  console.error('rating-visible: esta página no declara un aggregateRating completo');
  process.exit(1);
}
const value = Number(rating[1]).toFixed(1);
const reviews = count[1];

const CSS = `<style id="rating-visible-css">
  /* Rendered by tools/rating-visible.mjs — the numbers come from the JSON-LD. */
  .ratingv{display:inline-flex;align-items:center;gap:9px;text-decoration:none;color:inherit}
  .ratingv .st{color:var(--gold,#b28c53);font-size:.85rem;letter-spacing:.14em;line-height:1}
  .ratingv .tx{font-size:.66rem;letter-spacing:.18em;text-transform:uppercase;opacity:.75;transition:opacity .3s}
  .ratingv:hover .tx{opacity:1;text-decoration:underline;text-underline-offset:3px}
  .ratingv .tx b{font-weight:600}
</style>`;

const line =
  `<p style="margin:0 0 26px;text-align:center">` +
  `<a class="ratingv" href="${PROFILE}" target="_blank" rel="noopener">` +
  `<span class="st" aria-hidden="true">★★★★★</span>` +
  `<span class="tx"><b>${value}</b> on Google · ${reviews} guest reviews</span></a></p>`;

const block = `<!-- RATING:START (generado por tools/rating-visible.mjs — no editar a mano) -->
${CSS}
${line}
<!-- RATING:END -->`;

const START = '<!-- RATING:START';
const END = '<!-- RATING:END -->';
if (html.includes(START) && html.includes(END)) {
  html =
    html.slice(0, html.indexOf(START)) +
    block +
    html.slice(html.indexOf(END) + END.length);
} else {
  /* Directly above the FAQ, where a reader is already weighing whether to trust us. */
  const anchor = html.indexOf('<!-- FAQ:START');
  if (anchor < 0) {
    console.error('rating-visible: no encontré el bloque FAQ para anclarme');
    process.exit(1);
  }
  html = html.slice(0, anchor) + block + '\n' + html.slice(anchor);
}

const after = visibleText(html);
if (!after.includes(value) || !after.includes(reviews)) {
  console.error('rating-visible: seguiría sin verse la calificación o el número de reseñas');
  process.exit(1);
}

fs.writeFileSync(FILE, html);
console.log(`rating-visible: ${value} de ${reviews} reseñas, visible y enlazada al perfil.`);
