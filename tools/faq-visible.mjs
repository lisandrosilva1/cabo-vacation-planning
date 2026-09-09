/**
 * Render the visible FAQ from the page's own FAQPage markup.
 * -------------------------------------------------------------------------
 * This page shipped a FAQPage in JSON-LD whose questions appeared nowhere on
 * the page. Google asks for the marked-up content to be visible; invisible
 * questions earn nothing and risk a structured-data action. The same defect
 * shipped on four sites in this portfolio before anyone noticed, which is why
 * `npm run check:portfolio` in the CTB platform repo now tests for it.
 *
 * The fix is not to write the section by hand — that just creates two copies
 * that drift. The JSON-LD is the single source, and this renders the visible
 * half from it, between the FAQ:START / FAQ:END markers. Edit the questions in
 * the JSON-LD, re-run, and both halves move together.
 *
 *   node tools/faq-visible.mjs
 *
 * It refuses to write if any question would still be missing afterwards.
 */
import fs from 'node:fs';
import path from 'node:path';

const FILE = path.resolve('index.html');
let html = fs.readFileSync(FILE, 'utf8');

const decode = (s) =>
  s
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

const escape = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const visibleText = (h) =>
  decode(
    h
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  ).replace(/\s+/g, ' ');

/* ---- 1. the questions, from the markup that already exists ---- */
let qa = null;
for (const m of html.matchAll(
  /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi,
)) {
  let data;
  try {
    data = JSON.parse(m[1]);
  } catch {
    continue;
  }
  for (const node of Array.isArray(data) ? data : [data]) {
    if (node?.['@type'] === 'FAQPage' && node.mainEntity?.length) {
      qa = node.mainEntity.map((q) => ({
        q: decode(q.name),
        a: decode(q.acceptedAnswer?.text ?? ''),
      }));
    }
  }
}
if (!qa) {
  console.error('faq-visible: no encontré un FAQPage en el JSON-LD de index.html');
  process.exit(1);
}

/* ---- 2. styles, using whatever variables this page already defines ---- */
const CSS = `
<style id="faq-visible-css">
  /* Rendered by tools/faq-visible.mjs — edit the JSON-LD, not this. */
  .faqv{border-top:1px solid var(--line,rgba(0,0,0,.12))}
  .faqv details{border-bottom:1px solid var(--line,rgba(0,0,0,.12))}
  .faqv{color:inherit}
  .faqv summary{list-style:none;cursor:pointer;position:relative;padding:20px 44px 20px 0;
    font-weight:500;line-height:1.35;color:inherit}
  .faqv summary::-webkit-details-marker{display:none}
  .faqv summary::after{content:"";position:absolute;right:4px;top:50%;width:12px;height:12px;margin-top:-6px;
    background:linear-gradient(var(--gold,#b28c53),var(--gold,#b28c53)) center/12px 1px no-repeat,
               linear-gradient(var(--gold,#b28c53),var(--gold,#b28c53)) center/1px 12px no-repeat;
    transition:transform .4s cubic-bezier(.2,.7,.2,1)}
  .faqv details[open] summary::after{transform:rotate(135deg)}
  .faqv summary:focus-visible{outline:2px solid var(--gold,#b28c53);outline-offset:3px}
  .faqv p{margin:0;padding:0 44px 22px 0;max-width:44rem;line-height:1.7;opacity:.82}
  .faqv-eyebrow{display:block;font-size:11px;letter-spacing:.3em;text-transform:uppercase;
    color:var(--gold,#b28c53);font-weight:600}
  .faqv-title{margin:10px 0 26px;line-height:1.15}
</style>`;

/* ---- 3. the section, in this page's own container idiom ---- */
const hasWrap = /class="wrap"/.test(html);
const open = hasWrap
  ? '<section id="faq-visible"><div class="wrap"><div class="section-head center"><span class="faqv-eyebrow">Before you book</span><h2 class="faqv-title">Questions we get asked.</h2></div>'
  : '<section id="faq-visible" style="padding:40px 18px 26px;max-width:840px;margin:0 auto"><span class="faqv-eyebrow">Before you book</span><h2 class="faqv-title" style="font-size:1.5rem">Questions we get asked.</h2>';
const close = hasWrap ? '</div></section>' : '</section>';

const items = qa
  .map(
    ({ q, a }) =>
      `    <details><summary>${escape(q)}</summary><p>${escape(a)}</p></details>`,
  )
  .join('\n');

const block = `<!-- FAQ:START (generado por tools/faq-visible.mjs — no editar a mano) -->
${CSS}
${open}
  <div class="faqv">
${items}
  </div>
${close}
<!-- FAQ:END -->`;

/* ---- 4. replace between markers, or insert above the cross-link block ---- */
const START = '<!-- FAQ:START';
const END = '<!-- FAQ:END -->';
if (html.includes(START) && html.includes(END)) {
  html =
    html.slice(0, html.indexOf(START)) +
    block +
    html.slice(html.indexOf(END) + END.length);
} else {
  const anchor = html.indexOf('<section aria-label="More Cabo Travel Boutique services"');
  if (anchor < 0) {
    console.error('faq-visible: no encontré dónde insertar la sección');
    process.exit(1);
  }
  html = html.slice(0, anchor) + block + '\n' + html.slice(anchor);
}

/* ---- 5. refuse to write a page that would still hide a question ---- */
const after = visibleText(html);
const missing = qa.filter(({ q }) => !after.includes(q));
if (missing.length) {
  console.error('faq-visible: seguirían invisibles:', missing.map((m) => m.q));
  process.exit(1);
}

fs.writeFileSync(FILE, html);
console.log(`faq-visible: ${qa.length} preguntas visibles y marcadas, desde una sola fuente.`);
