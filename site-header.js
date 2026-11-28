// Shared site header (floating dark-green bar, students.bd style).
// Used by build.js (static pages) AND src/worker.js (directory pages).
// To add / remove / reorder a menu link, edit NAV below - every page follows.
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const CHEV = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

// Order = priority. Links that do not fit on the screen automatically go under "আরও".
function navItems(cats) {
  return [
    ['হোম', '/'],
    ['শিক্ষাপ্রতিষ্ঠান', '/institutions/'],
    ['ভর্তি ক্যালেন্ডার', '/admission-calendar/'],
    ...(cats || []).map((c) => [c.name, '/category/' + c.slug + '/']),
    ['SSC GPA ক্যালকুলেটর', '/ssc-gpa-calculator/'],
    ['EMIS টুল', '/emis/'],
  ];
}

function siteHeader({ name, cats }) {
  const links = navItems(cats).map((x) => `<a class="sh-a" href="${x[1]}">${esc(x[0])}</a>`).join('');
  return `<header class="sh"><div class="sh-bar"><a class="sh-logo" href="/" aria-label="${esc(name)} - হোম"><span class="sh-name">${esc(name)}<small>.me</small></span></a><span class="sh-sep" aria-hidden="true"></span><nav class="sh-links" id="sh-links" aria-label="প্রধান মেনু">${links}</nav><div class="sh-more" hidden><button type="button" class="sh-a sh-morebtn" aria-expanded="false" aria-haspopup="true">আরও ${CHEV}</button><div class="sh-drop"></div></div><button type="button" class="sh-burger" aria-label="মেনু খুলুন" aria-expanded="false" aria-controls="sh-links"><span></span><span></span><span></span></button></div></header>`;
}

module.exports = siteHeader;
module.exports.default = siteHeader;
