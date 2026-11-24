// ============================================================================
// admission-build.js — GitHub-driven Admission Calendar (no database)
// Data: content/admission/*.json (one file per exam)  +  content/admission-settings.json
// Output: dist/admission-calendar/index.html, /{slug}/index.html, calendar.ics
// Edited from Decap CMS (admin/cms.html -> "ভর্তি পরীক্ষা ক্যালেন্ডার") or directly on GitHub.
// ============================================================================
const fs = require('fs'), path = require('path'), cp = require('child_process');

module.exports = function ({ esc, w, layout, side, bc, U, S, clip = (t, n = 160) => String(t || '').slice(0, n), absU = (x) => x, OG = '' }) {
  const DIR = 'content/admission';
  const CATS = { public: 'সাধারণ বিশ্ববিদ্যালয়', engineering: 'প্রকৌশল ও প্রযুক্তি', medical: 'মেডিকেল', agriculture: 'কৃষি', cluster: 'গুচ্ছ', specialized: 'বিশেষায়িত', private: 'বেসরকারি' };
  const BD = '০১২৩৪৫৬৭৮৯';
  const bn = (v) => String(v == null ? '' : v).replace(/\d/g, (d) => BD[d]);
  const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { console.warn('[admission] bad JSON', f, e.message); return null; } };
  const T = (v) => String(v == null ? '' : v).trim();
  const buildDay = new Date().toISOString().slice(0, 10);
  const gitDay = (f) => { try { return cp.execSync(`git log -1 --format=%cs -- "${f}"`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || null; } catch (e) { return null; } };

  const set = Object.assign({ season: '২০২৬-২৭', seo_title: '', seo_description: '', intro_bn: '', telegram_url: '' },
    fs.existsSync('content/admission-settings.json') ? (readJson('content/admission-settings.json') || {}) : {});
  const season = set.season || '২০২৬-২৭';

  let list = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => {
    const e = readJson(path.join(DIR, f)); if (!e) return null;
    e.slug = T(e.slug || f.slice(0, -5)).toLowerCase(); e._file = path.join(DIR, f); return e;
  }).filter(Boolean) : [];
  list = list.filter((e) => e.published !== false && T(e.university_bn) && /^[a-z0-9][a-z0-9-]*$/.test(e.slug));
  const seen = new Set(); list = list.filter((e) => (seen.has(e.slug) ? false : seen.add(e.slug)));
  list.forEach((e) => {
    const d = T(e.exam_date), tm = /^\d{2}:\d{2}$/.test(T(e.exam_time)) ? T(e.exam_time) : '10:00';
    e.exam_at = /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T${tm}` : null;
    e.ms = e.exam_at ? Date.parse(e.exam_at + ':00+06:00') : NaN;
    e.lastmod = gitDay(e._file) || buildDay;
    e.sections = Array.isArray(e.sections) ? e.sections : [];
  });
  list.sort((a, b) => (isNaN(a.ms) - isNaN(b.ms)) || (a.ms - b.ms) || a.slug.localeCompare(b.slug));
  const pageLast = list.reduce((m, e) => (e.lastmod > m ? e.lastmod : m), '') || buildDay;

  const ymdBn = (ymd, o) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd || ''); if (!m) return ''; return new Intl.DateTimeFormat('bn-BD', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric', ...(o || {}) }).format(Date.UTC(+m[1], +m[2] - 1, +m[3])); };
  const timeBn = (s) => { const m = /T(\d{2}):(\d{2})/.exec(s || ''); if (!m) return ''; let h = +m[1]; const p = h < 5 ? 'ভোর' : h < 12 ? 'সকাল' : h < 15 ? 'দুপুর' : h < 18 ? 'বিকাল' : h < 20 ? 'সন্ধ্যা' : 'রাত'; h = h % 12 || 12; return `${p} ${bn(h)}:${bn(m[2])}`; };
  const nm = (e) => (e.short_bn || e.university_bn) + (e.unit ? ` (${e.unit})` : '');
  const full = (e) => e.university_bn + (e.unit ? ` ${e.unit} ইউনিট` : '');
  const url = (e) => `/admission-calendar/${e.slug}/`;
  const has = (e) => !isNaN(e.ms);
  const today = new Date(Date.now() + 6 * 3600e3).toISOString().slice(0, 10);
  const astat = (e) => (e.apply_end && e.apply_end < today ? 3 : e.apply_start && e.apply_start > today ? 2 : 1);
  const second = (e) => (e.second_time === 'yes' ? 'আছে' : e.second_time === 'no' ? 'নেই' : '');
  const ext = (u, t) => (T(u) ? `<a class="adm-btn" href="${esc(u)}" target="_blank" rel="noopener noreferrer">${t} ↗</a>` : '');
  const faqHtml = (items) => `<section class="faq"><h2>সচরাচর জিজ্ঞাসা (FAQ)</h2>${items.map((x) => `<details><summary>${esc(x.q)}</summary><p>${esc(x.a)}</p></details>`).join('')}</section>`;
  const faqLd = (items) => ({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: items.map((x) => ({ '@type': 'Question', name: x.q, acceptedAnswer: { '@type': 'Answer', text: x.a } })) });

  const CSS = `<style>.adm .tw{overflow-x:auto;margin:8px 0;border-radius:8px}.adm .at{width:100%;border-collapse:collapse;font-size:15px}.adm .at th,.adm .at td{border:1px solid #d1fae5;padding:8px 10px;text-align:left;vertical-align:top}.adm .at th{background:var(--l);color:var(--g)}.adm .at tbody tr:nth-child(even){background:#f7fdf9}.adm .cd{color:#047857;font-weight:600;white-space:nowrap}.adm .nt{font-size:13.5px;color:#475569;margin:6px 0 0}.adm .st{display:inline-block;font-size:12px;font-weight:600;padding:1px 8px;border-radius:10px}.adm .st1{background:#dcfce7;color:#166534}.adm .st2{background:#fef9c3;color:#854d0e}.adm .st3{background:#fee2e2;color:#991b1b}.adm .tent{color:#b45309;font-weight:700;cursor:help;border:0}.adm .chips{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 10px}.adm .chips a{border:1px solid #a7f3d0;background:var(--l);border-radius:999px;padding:3px 12px;font-size:14px;font-weight:600}.adm .qs{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:10px 0}.adm .qs div{background:#fff;border:1px solid #d1fae5;border-radius:8px;padding:6px 10px}.adm .qs small{display:block;color:#64748b;font-size:12px}.adm-btn{display:inline-block;padding:6px 14px;border:1.5px solid var(--g);border-radius:999px;font-size:14px;font-weight:600;margin:3px 6px 3px 0;background:#fff}.adm-btn.pri{background:var(--g);color:#fff}.adm .months{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}.adm .mo{border:1px solid #d1fae5;border-radius:10px;overflow:hidden}.adm .mo h3{margin:0;padding:6px 12px;background:var(--l);font-size:15px;color:var(--g)}.adm .mg{display:grid;grid-template-columns:repeat(7,1fr);padding:6px;gap:2px;text-align:center;font-size:13.5px;line-height:1.9}.adm .mg b{font-size:12px;color:#64748b}.adm .mg a{background:var(--g);color:#fff;font-weight:700;border-radius:50%}.adm h3.sec-t{margin:14px 0 4px;color:var(--g);font-size:17px}@media print{header,footer,aside,.noprint{display:none!important}.grid{display:block}}</style>`;
  const JS = `<script>(function(){var N=new Intl.NumberFormat('bn-BD',{minimumIntegerDigits:2,useGrouping:false});function f(ms){var s=Math.floor((ms-Date.now())/1000);if(s<=0)return'পরীক্ষা শুরু / সম্পন্ন';var d=Math.floor(s/86400);s%=86400;return N.format(d)+' দিন '+N.format(Math.floor(s/3600))+' ঘণ্টা '+N.format(Math.floor(s%3600/60))+' মিনিট '+N.format(s%60)+' সেকেন্ড'}function t(){document.querySelectorAll('[data-t]').forEach(function(e){e.textContent=f(+e.dataset.t)})}t();setInterval(t,1000);var td=new Date(Date.now()+216e5).toISOString().slice(0,10);document.querySelectorAll('[data-st]').forEach(function(e){var s=e.dataset.as,x=e.dataset.ae,c=x&&x<td?3:(s&&s>td?2:1);e.className='st st'+c;e.textContent=['','চলছে','শুরু হবে','শেষ'][c]});document.querySelectorAll('[data-ce]').forEach(function(a){if(a.dataset.ce&&a.dataset.ce<td)a.style.display='none'})})()</script>`;
  const crumbs = (items) => `<nav class="meta noprint" style="margin-bottom:8px">${items.map((x, i) => (x[1] ? `<a href="${x[1]}">${esc(x[0])}</a>` : `<span>${esc(x[0])}</span>`)).join(' › ')}</nav>`;

  function monthGrid(up) {
    const days = {}; up.forEach((e) => { const k = e.exam_at.slice(0, 10); (days[k] = days[k] || []).push(nm(e)); });
    const keys = Object.keys(days).sort(); if (!keys.length) return '';
    const [sy, sm] = today.split('-').map(Number), [ey, em] = keys[keys.length - 1].split('-').map(Number);
    const total = Math.min(10, (ey * 12 + em) - (sy * 12 + sm) + 1), WK = ['র', 'সো', 'ম', 'বু', 'বৃ', 'শু', 'শ'];
    let out = '';
    for (let i = 0; i < Math.max(total, 1); i++) {
      const idx = sy * 12 + (sm - 1) + i, y = Math.floor(idx / 12), m = idx % 12, off = new Date(Date.UTC(y, m, 1)).getUTCDay(), dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
      let g = WK.map((x) => `<b>${x}</b>`).join('') + '<span></span>'.repeat(off);
      for (let d = 1; d <= dim; d++) { const k = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`; g += days[k] ? `<a href="#d-${k}" title="${esc(days[k].join(', '))}">${bn(d)}</a>` : `<span>${bn(d)}</span>`; }
      out += `<div class="mo"><h3>${ymdBn(`${y}-${String(m + 1).padStart(2, '0')}-01`, { day: undefined })}</h3><div class="mg">${g}</div></div>`;
    }
    return `<section class="box"><h2>ভর্তি পরীক্ষার ক্যালেন্ডার (মাসভিত্তিক)</h2><div class="months">${out}</div><p class="nt">গাঢ় সবুজ তারিখে ভর্তি পরীক্ষা আছে; তারিখে ক্লিক করলে সংশ্লিষ্ট পরীক্ষায় যাবে।</p></section>`;
  }

  // ---------------- main page ----------------
  const withDate = list.filter(has), upcoming = withDate.filter((e) => e.ms > Date.now()), past = withDate.filter((e) => e.ms <= Date.now()).reverse();
  const tba = list.filter((e) => !has(e)), applyRows = list.filter((e) => e.apply_start || e.apply_end), ongoing = applyRows.filter((e) => astat(e) === 1);
  const applySorted = [...applyRows].sort((a, b) => astat(a) - astat(b) || String(a.apply_end || '9').localeCompare(String(b.apply_end || '9')));
  const first = upcoming[0], seenDay = new Set();
  const upRows = upcoming.map((e) => { const k = e.exam_at.slice(0, 10), id = seenDay.has(k) ? '' : ` id="d-${k}"`; seenDay.add(k); return `<tr${id}><td><a href="${url(e)}">${esc(nm(e))}</a></td><td>${ymdBn(k, { weekday: 'long' })}, ${timeBn(e.exam_at)}${e.date_status === 'confirmed' ? '' : ' <abbr class="tent" title="কর্তৃপক্ষ সম্ভাব্য তারিখ জানিয়েছে">*</abbr>'}</td><td class="cd" data-t="${e.ms}">${ymdBn(k)}</td></tr>`; }).join('');
  const apRows = applySorted.map((e) => { const c = astat(e); return `<tr><td><a href="${url(e)}">${esc(nm(e))}</a></td><td>${e.apply_start ? ymdBn(e.apply_start) : '—'}</td><td>${e.apply_end ? ymdBn(e.apply_end) : '—'}</td><td>${esc(T(e.apply_fee) || '—')}</td><td><span class="st st${c}" data-st data-as="${esc(e.apply_start || '')}" data-ae="${esc(e.apply_end || '')}">${['', 'চলছে', 'শুরু হবে', 'শেষ'][c]}</span> ${T(e.apply_url) ? `<a href="${esc(e.apply_url)}" target="_blank" rel="noopener noreferrer">আবেদন লিংক ↗</a>` : ''}</td></tr>`; }).join('');
  const groups = {}; list.forEach((e) => { const k = e.short_bn || e.university_bn; (groups[k] = groups[k] || []).push(e); });
  const gHtml = Object.entries(groups).map(([k, a]) => `<li><strong>${esc(k)}:</strong> ${a.map((e) => `<a href="${url(e)}">${esc(e.unit ? e.unit + ' ইউনিট' : 'বিস্তারিত')}</a>`).join(' · ')}</li>`).join('');
  const dTxt = (e) => `${ymdBn(e.exam_at.slice(0, 10))}, ${timeBn(e.exam_at)}`;
  const faq = [];
  if (first) faq.push({ q: `${season} সেশনের ভর্তি পরীক্ষা কবে থেকে শুরু?`, a: `বর্তমান সময়সূচি অনুযায়ী সবচেয়ে কাছের ভর্তি পরীক্ষা ${nm(first)} — ${dTxt(first)}।` });
  for (const [k, a] of Object.entries(groups)) { const dd = a.filter(has); if (faq.length >= 6 || !dd.length || !/ঢাবি|বুয়েট|জবি|চবি|রাবি|মেডিকেল|গুচ্ছ|জাবি|কুয়েট/.test(k)) continue; faq.push({ q: `${k} ভর্তি পরীক্ষা ${season} কবে?`, a: dd.map((e) => `${e.unit ? e.unit + ' ইউনিট' : k}: ${dTxt(e)}`).join('; ') + '।' }); }
  if (ongoing.length) faq.push({ q: 'এখন কোন কোন বিশ্ববিদ্যালয়ে ভর্তির আবেদন চলছে?', a: ongoing.map((e) => `${nm(e)} (শেষ তারিখ ${e.apply_end ? ymdBn(e.apply_end) : 'অজানা'})`).join('; ') + '।' });
  faq.push({ q: 'এই ক্যালেন্ডারের তারিখ কি চূড়ান্ত?', a: 'তারিখের পাশে * চিহ্ন থাকলে কর্তৃপক্ষ সম্ভাব্য তারিখ জানিয়েছে। চূড়ান্ত তথ্যের জন্য সংশ্লিষ্ট বিশ্ববিদ্যালয়ের অফিসিয়াল সার্কুলার ও ওয়েবসাইট দেখুন।' });
  const title = T(set.seo_title) || `ভর্তি পরীক্ষার ক্যালেন্ডার ${season}`;
  const desc = T(set.seo_description) || `${season} সেশনের সব বিশ্ববিদ্যালয়ের ভর্তি পরীক্ষার তারিখ, আবেদনের সময়সীমা ও মানবণ্টন।`;

  const mainBody = `${CSS}${crumbs([['হোম', '/'], ['ভর্তি ক্যালেন্ডার', '']])}<div class="grid"><div class="adm">
  <div class="hero"><h1>ভর্তি পরীক্ষার ক্যালেন্ডার ${esc(season)}: তারিখ, আবেদন ও কাউন্টডাউন</h1><p>${esc(set.intro_bn || '')}</p>
  <div class="noprint"><a class="adm-btn pri" href="/admission-calendar/calendar.ics" rel="nofollow">রিমাইন্ডার (.ics)</a><a class="adm-btn" href="#apply">আবেদনের সময়সীমা</a><a class="adm-btn" href="#faq">FAQ</a><a class="adm-btn" href="javascript:print()">প্রিন্ট / PDF</a>${T(set.telegram_url) ? `<a class="adm-btn" href="${esc(set.telegram_url)}" target="_blank" rel="noopener">টেলিগ্রাম আপডেট</a>` : ''}</div>
  <div class="qs"><div><small>পরবর্তী পরীক্ষা</small><strong>${first ? esc(nm(first)) + ' — ' + ymdBn(first.exam_at.slice(0, 10), { year: undefined }) : '—'}</strong></div><div><small>আসন্ন পরীক্ষা</small><strong>${bn(upcoming.length)} টি</strong></div><div><small>আবেদন চলছে</small><strong>${bn(ongoing.length)} টি</strong></div><div><small>সর্বশেষ আপডেট</small><strong>${ymdBn(pageLast)}</strong></div></div></div>
  ${ongoing.length ? `<section class="box"><h2>এখন আবেদন চলছে</h2><div class="chips">${ongoing.map((e) => `<a href="${url(e)}" data-ce="${esc(e.apply_end || '')}">${esc(nm(e))} · শেষ ${e.apply_end ? ymdBn(e.apply_end, { year: undefined }) : '—'}</a>`).join('')}</div></section>` : ''}
  <section class="box"><h2>ভর্তি পরীক্ষার সময়সূচি ${esc(season)}</h2><div class="tw"><table class="at"><thead><tr><th>বিশ্ববিদ্যালয় / ইউনিট</th><th>পরীক্ষার তারিখ ও সময়</th><th>সময় বাকি</th></tr></thead><tbody>${upRows || '<tr><td colspan="3">কোনো আসন্ন পরীক্ষা নেই।</td></tr>'}</tbody></table></div><p class="nt">* চিহ্নিত তারিখ কর্তৃপক্ষ সম্ভাব্য তারিখ হিসেবে জানিয়েছে। সব সময় বাংলাদেশ সময় (GMT+6)।</p></section>
  <section class="box" id="apply"><h2>আবেদনের সময়সীমা ও ফি</h2><div class="tw"><table class="at"><thead><tr><th>বিশ্ববিদ্যালয় / ইউনিট</th><th>আবেদন শুরু</th><th>আবেদনের শেষ</th><th>ফি</th><th>অবস্থা ও লিংক</th></tr></thead><tbody>${apRows || '<tr><td colspan="5">আবেদনের তথ্য শীঘ্রই যোগ হবে।</td></tr>'}</tbody></table></div></section>
  ${monthGrid(upcoming)}
  <section class="box"><h2>বিশ্ববিদ্যালয় অনুযায়ী বিস্তারিত (মানবণ্টন, কেন্দ্র, নেগেটিভ মার্কিং)</h2><ul style="columns:2 250px;list-style:none;padding:0;margin:0">${gHtml}</ul></section>
  ${tba.length ? `<section class="box"><h2>তারিখ ঘোষণার অপেক্ষায়</h2><div class="chips">${tba.map((e) => `<a href="${url(e)}">${esc(nm(e))}</a>`).join('')}</div></section>` : ''}
  <div id="faq">${faqHtml(faq)}</div>
  ${past.length ? `<section class="box"><h2>অনুষ্ঠিত / সম্পন্ন পরীক্ষা</h2><details><summary>${bn(past.length)}টি পরীক্ষা দেখুন</summary><ul>${past.map((e) => `<li><a href="${url(e)}">${esc(nm(e))}</a> — ${ymdBn(e.exam_at.slice(0, 10))}</li>`).join('')}</ul></details></section>` : ''}
  <p class="nt"><strong>সতর্কতা:</strong> তথ্য বিভিন্ন সূত্র থেকে সংকলিত। আবেদন বা পরীক্ষার আগে অফিসিয়াল সার্কুলার ও ওয়েবসাইট দেখে যাচাই করুন। ভুল পেলে <a href="/contact/">আমাদের জানান</a>।</p>
  </div>${side()}</div>${JS}`;
  w('admission-calendar/index.html', layout({ title: `${title} | ${S.name}`, desc, p: '/admission-calendar/', body: mainBody, schema: [
    bc([['হোম', '/'], ['ভর্তি ক্যালেন্ডার', '/admission-calendar/']]),
    { '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, description: desc, url: U + '/admission-calendar/', inLanguage: 'bn-BD', dateModified: pageLast, isPartOf: { '@type': 'WebSite', name: S.name, url: U },
      mainEntity: { '@type': 'ItemList', numberOfItems: upcoming.length, itemListElement: upcoming.slice(0, 50).map((e, i) => ({ '@type': 'ListItem', position: i + 1, url: U + url(e), name: `${full(e)} ভর্তি পরীক্ষা` })) } },
    faqLd(faq)] }));

  // ---------------- detail pages ----------------
  list.forEach((e) => {
    const sib = list.filter((x) => x.university_bn === e.university_bn && x !== e);
    const dt = has(e) ? `${ymdBn(e.exam_at.slice(0, 10), { weekday: 'long' })}, ${timeBn(e.exam_at)}` : 'ঘোষণা হয়নি';
    const es = e.season || season;
    const dParts = [];
    if (e.apply_end) dParts.push(`আবেদনের শেষ তারিখ ${ymdBn(e.apply_end)}`);
    if (T(e.marks_text)) dParts.push(e.marks_text);
    if (T(e.negative_marking)) dParts.push(`নেগেটিভ মার্কিং ${e.negative_marking}`);
    let d0 = `${full(e)} ভর্তি পরীক্ষা ${es}: পরীক্ষার তারিখ ${has(e) ? ymdBn(e.exam_at.slice(0, 10)) : 'ঘোষণার অপেক্ষায়'}`;
    dParts.forEach((x) => { if ((d0 + ', ' + x).length <= 128) d0 += ', ' + x; });
    d0 += '। মানবণ্টন ও কেন্দ্র দেখুন।';
    const d = T(e.seo_description) || d0;
    const row = (k, v) => (T(v) ? `<tr><th>${k}</th><td>${v}</td></tr>` : '');
    const secs = e.sections.filter((s) => s && (s.t || (s.rules || []).length));
    const f = [];
    if (has(e)) f.push({ q: `${full(e)} ভর্তি পরীক্ষা কবে?`, a: `${full(e)} ভর্তি পরীক্ষা ${dt}${e.date_status === 'confirmed' ? '' : ' (কর্তৃপক্ষ সম্ভাব্য তারিখ জানিয়েছে; চূড়ান্ত সার্কুলার দেখুন)'}।` });
    if (T(e.negative_marking)) f.push({ q: `${nm(e)} ভর্তি পরীক্ষায় নেগেটিভ মার্কিং আছে কি?`, a: /নেই/.test(e.negative_marking) ? 'না, নেগেটিভ মার্কিং নেই।' : `হ্যাঁ, ভুল উত্তরের জন্য ${e.negative_marking} নম্বর কাটা হবে।` });
    if (T(e.center_text)) f.push({ q: `${nm(e)} ভর্তি পরীক্ষার কেন্দ্র কোথায়?`, a: e.center_text + '।' });
    if (e.apply_end) f.push({ q: `${nm(e)} ভর্তির আবেদনের শেষ তারিখ কবে?`, a: `আবেদনের শেষ তারিখ ${ymdBn(e.apply_end)}${e.apply_start ? `; আবেদন শুরু ${ymdBn(e.apply_start)}` : ''}।` });
    const body = `${CSS}${crumbs([['হোম', '/'], ['ভর্তি ক্যালেন্ডার', '/admission-calendar/'], [nm(e), '']])}<div class="grid"><div class="adm">
    <div class="hero"><p class="meta"><span class="tag">${esc(CATS[e.category] || 'ভর্তি')}</span> <span class="tag">${e.date_status === 'confirmed' ? 'তারিখ নিশ্চিত' : 'সম্ভাব্য তারিখ'}</span></p><h1>${esc(full(e))} ভর্তি পরীক্ষা ${esc(es)}</h1><p>পরীক্ষার তারিখ: <strong>${dt}</strong></p>${has(e) ? `<p class="cd">সময় বাকি: <span data-t="${e.ms}"></span></p>` : ''}
    <div class="noprint">${ext(e.apply_url, 'আবেদন লিংক')}${ext(e.circular_url, 'অফিসিয়াল সার্কুলার')}${ext(e.official_url, 'অফিসিয়াল ওয়েবসাইট')}<a class="adm-btn" href="/admission-calendar/">সব পরীক্ষার তালিকা</a></div></div>
    <section class="box"><h2>এক নজরে</h2><div class="tw"><table class="at"><tbody>${row('পরীক্ষার তারিখ', dt)}${row('নম্বর ও সময়', esc(e.marks_text))}${row('পরীক্ষা কেন্দ্র', esc(e.center_text))}${row('সেকেন্ড টাইম', second(e))}${row('নেগেটিভ মার্কিং', esc(e.negative_marking))}${row('আবেদন শুরু', e.apply_start ? ymdBn(e.apply_start) : '')}${row('আবেদনের শেষ', e.apply_end ? ymdBn(e.apply_end) : '')}${row('আবেদন ফি', esc(e.apply_fee))}</tbody></table></div></section>
    ${secs.length ? `<section class="box"><h2>বিষয়ভিত্তিক মানবণ্টন ও নিয়ম</h2>${secs.map((s) => `<h3 class="sec-t">${esc(s.t || '')}</h3><div class="tw"><table class="at"><tbody>${(s.rules || []).map((r) => `<tr><th>${esc(r.r || '')}</th><td>${esc(r.s || '')}</td></tr>`).join('')}</tbody></table></div>`).join('')}</section>` : ''}
    ${T(e.notes_bn) ? `<section class="box"><h2>গুরুত্বপূর্ণ নোট</h2><p>${esc(e.notes_bn).replace(/\n/g, '<br>')}</p></section>` : ''}
    ${sib.length ? `<section class="box"><h2>${esc(e.short_bn || e.university_bn)}-এর অন্যান্য ইউনিট</h2><div class="chips">${sib.map((x) => `<a href="${url(x)}">${esc(nm(x))}${has(x) ? ' · ' + ymdBn(x.exam_at.slice(0, 10), { year: undefined }) : ''}</a>`).join('')}</div></section>` : ''}
    ${f.length ? faqHtml(f) : ''}
    <p class="nt"><strong>সতর্কতা:</strong> তথ্য সংকলিত; আবেদনের আগে অফিসিয়াল সার্কুলার দেখে নিন। <a href="/admission-calendar/">← সকল ভর্তি পরীক্ষার ক্যালেন্ডার</a></p>
    </div>${side()}</div>${JS}`;
    const schema = [bc([['হোম', '/'], ['ভর্তি ক্যালেন্ডার', '/admission-calendar/'], [nm(e), url(e)]]),
      { '@context': 'https://schema.org', '@type': 'WebPage', name: `${full(e)} ভর্তি পরীক্ষা ${es}`, description: clip(d, 300), url: U + url(e), inLanguage: 'bn-BD', dateModified: e.lastmod, isPartOf: { '@type': 'WebSite', name: S.name, url: U } }];
    if (has(e) && e.date_status === 'confirmed') schema.push({ '@context': 'https://schema.org', '@type': 'Event', name: `${full(e)} ভর্তি পরীক্ষা ${es}`, description: d, startDate: `${e.exam_at}:00+06:00`, endDate: `${new Date(e.ms + 9 * 3600e3).toISOString().slice(0, 19)}+06:00`, inLanguage: 'bn-BD', ...(OG ? { image: [absU(OG)] } : {}), eventStatus: 'https://schema.org/EventScheduled', eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode', location: { '@type': 'Place', name: T(e.center_text) || e.university_bn, address: { '@type': 'PostalAddress', addressCountry: 'BD' } }, organizer: { '@type': 'Organization', name: e.university_bn, ...(T(e.official_url) ? { url: e.official_url } : {}) }, url: U + url(e) });
    if (f.length) schema.push(faqLd(f));
    w(`admission-calendar/${e.slug}/index.html`, layout({ title: T(e.seo_title) || `${full(e)} ভর্তি পরীক্ষা ${es}: তারিখ, আবেদন ও মানবণ্টন | ${S.name}`, desc: d, p: url(e), body, schema }));
  });

  // ---------------- .ics ----------------
  const z = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  const u = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const o = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//bdresult.me//Admission Calendar//BN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:ভর্তি পরীক্ষা'];
  list.filter((e) => has(e) && e.ms > Date.now() - 864e5).forEach((e) => {
    const n = `${nm(e)} ভর্তি পরীক্ষা`;
    o.push('BEGIN:VEVENT', `UID:${e.slug}@bdresult.me`, `DTSTAMP:${u(Date.now())}`, `DTSTART:${u(e.ms)}`, `DTEND:${u(e.ms + 3 * 3600e3)}`, `SUMMARY:${z(n)}`, `URL:${U}${url(e)}`,
      `DESCRIPTION:${z((T(e.center_text) ? 'কেন্দ্র: ' + e.center_text + '. ' : '') + 'অফিসিয়াল সার্কুলার যাচাই করুন: ' + U + url(e))}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${z(n + ' আগামীকাল')}`, 'TRIGGER:-P1D', 'END:VALARM', 'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${z(n + ' এক ঘণ্টা পরে')}`, 'TRIGGER:-PT1H', 'END:VALARM', 'END:VEVENT');
  });
  o.push('END:VCALENDAR');
  w('admission-calendar/calendar.ics', o.join('\r\n'));

  console.log('Admission calendar:', list.length, 'exams');
  return { urls: [{ u: '/admission-calendar/', lm: pageLast }, ...list.map((e) => ({ u: url(e), lm: e.lastmod }))] };
};
