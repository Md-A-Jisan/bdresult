// ============================================================================
// BDRESULT.ME - COMPLETE CLOUDFLARE WORKER & D1 PLATFORM ENGINE (ALL 21 MODULES)
// File: src/worker.js
// ============================================================================

const SITE_URL = 'https://bdresult.me';
const SITE_NAME = 'bdresult';

const formatExternalUrl = (u) => {
  const s = String(u || '').trim();
  if (!s) return '';
  return /^https?:\/\//i.test(s) ? s : 'https://' + s;
};
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

const normalizeName = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9\u0980-\u09ff]/g, '');

const slugify = (s) => String(s || '')
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9-]+/g, '-')
  .replace(/-+/g, '-')
  .replace(/^-|-$/g, '') || ('item-' + Date.now());

const parseJsonSafe = (str, fallback = []) => {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
};

// Simple Markdown/HTML sanitizer for database posts (XSS Prevention)
function sanitizeHtml(raw) {
  return String(raw || '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript:/gi, '');
}

// Plain text -> safe HTML (keeps line breaks, "- " / "• " bullets, numbered lines, blank-line paragraphs)
function formatText(raw) {
  const text = String(raw || '').replace(/\r\n?/g, '\n').trim();
  if (!text) return '';
  const inline = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  const bulletRe = /^\s*(?:[-*•–]|\u2022)\s+(.*)$/;
  const numRe = /^\s*(?:\d+|[০-৯]+)[.)।]\s+(.*)$/;
  const out = [];
  let para = [], list = null;
  const flushPara = () => { if (para.length) { out.push('<p>' + para.map(inline).join('<br>') + '</p>'); para = []; } };
  const flushList = () => { if (list) { out.push('<' + list.tag + '>' + list.items.map(i => '<li>' + inline(i) + '</li>').join('') + '</' + list.tag + '>'); list = null; } };
  for (const line of text.split('\n')) {
    if (!line.trim()) { flushPara(); flushList(); continue; }
    let m;
    if ((m = line.match(bulletRe))) { flushPara(); if (!list || list.tag !== 'ul') { flushList(); list = { tag: 'ul', items: [] }; } list.items.push(m[1]); }
    else if ((m = line.match(numRe))) { flushPara(); if (!list || list.tag !== 'ol') { flushList(); list = { tag: 'ol', items: [] }; } list.items.push(m[1]); }
    else { flushList(); para.push(line.trim()); }
  }
  flushPara(); flushList();
  return out.join('');
}

// Post body: real HTML stays HTML (sanitized); plain text / markdown-lite is converted
function renderPostBody(raw) {
  const src = String(raw || '');
  if (/<(p|div|h[1-6]|ul|ol|li|br|table|img|blockquote)[\s>\/]/i.test(src)) return sanitizeHtml(src);
  const text = src.replace(/\r\n?/g, '\n').trim();
  const blocks = text.split(/\n{2,}/).map(blk => {
    const lines = blk.split('\n');
    if (lines.length === 1) {
      const h = lines[0].match(/^(#{1,4})\s+(.*)$/);
      if (h) { const lv = Math.min(h[1].length + 1, 5); return `<h${lv}>${esc(h[2])}</h${lv}>`; }
    }
    return formatText(blk).replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" rel="noopener">$1</a>');
  });
  return blocks.join('');
}

const jsonResponse = (data, status = 200, extraHeaders = {}) => new Response(JSON.stringify(data), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    ...extraHeaders
  }
});

function calculateCompleteness(inst) {
  let score = 0;
  if (inst.name_bn && inst.name_en) score += 15;
  if (inst.eiin) score += 15;
  if (inst.overview_bn && inst.overview_bn.length > 40) score += 20;
  if (inst.address_bn) score += 10;
  if (inst.established_year) score += 10;
  if (inst.education_board) score += 10;
  if (inst.history_bn || inst.admission_info_bn) score += 10;
  if (inst.verification_status === 'verified') score += 10;
  return Math.min(100, score);
}

// Single source of truth: a profile is indexable (and in the sitemap) only when published + verified + score >= 50.
// Score is recomputed from the real fields (not the stored completeness_score, which can be stale).
const isInstitutionIndexable = (inst) =>
  Number(inst.is_published) === 1 && inst.verification_status === 'verified' && calculateCompleteness(inst) >= 50;

const INDEXABLE_SQL = `i.is_published = 1 AND i.verification_status = 'verified' AND (
  (CASE WHEN COALESCE(i.name_bn,'') <> '' AND COALESCE(i.name_en,'') <> '' THEN 15 ELSE 0 END) +
  (CASE WHEN COALESCE(i.eiin,'') <> '' THEN 15 ELSE 0 END) +
  (CASE WHEN LENGTH(COALESCE(i.overview_bn,'')) > 40 THEN 20 ELSE 0 END) +
  (CASE WHEN COALESCE(i.address_bn,'') <> '' THEN 10 ELSE 0 END) +
  (CASE WHEN COALESCE(i.established_year,0) <> 0 THEN 10 ELSE 0 END) +
  (CASE WHEN COALESCE(i.education_board,'') <> '' THEN 10 ELSE 0 END) +
  (CASE WHEN COALESCE(i.history_bn,'') <> '' OR COALESCE(i.admission_info_bn,'') <> '' THEN 10 ELSE 0 END) + 10
) >= 50`;
const SITEMAP_PAGE_SIZE = 45000;

// Site-wide head config (GA + Search Console tag) generated by build.js -> /site-config.json
let SITE_CFG = null;
async function ensureSiteConfig(env) {
  if (SITE_CFG) return;
  try {
    const r = await env.ASSETS.fetch(new Request(SITE_URL + '/site-config.json'));
    if (r.ok) SITE_CFG = await r.json();
  } catch (e) { /* config optional */ }
}

async function hashIp(ip) {
  const data = new TextEncoder().encode((ip || '0.0.0.0') + '-bdresult-salt');
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Rate limit check via D1 (Max N actions per IP hash in last 1 hour)
async function isRateLimited(env, ipHash, tableName, maxPerHour = 10) {
  try {
    const row = await env.DB.prepare(
      `SELECT COUNT(*) as c FROM ${tableName} WHERE ip_hash = ? AND created_at >= datetime('now', '-1 hour')`
    ).bind(ipHash).first();
    return (row?.c || 0) >= maxPerHour;
  } catch {
    return false;
  }
}

// ============================================================================
// AUTHENTICATION & RBAC
// ============================================================================
async function authenticateAdmin(req, env) {
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  const ghRes = await fetch('https://api.github.com/user', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'bdresult-admin-worker',
      'Accept': 'application/vnd.github+json'
    }
  });

  if (!ghRes.ok) return null;
  const ghUser = await ghRes.json();
  if (!ghUser || !ghUser.login) return null;

  const dbUser = await env.DB.prepare(
    `SELECT id, github_username, display_name, role, is_active FROM admin_users WHERE LOWER(github_username) = LOWER(?) AND is_active = 1`
  ).bind(ghUser.login).first();

  if (!dbUser) return null;
  return dbUser;
}

async function logAudit(env, adminId, actionType, entityType, entityId, changes, ip) {
  try {
    await env.DB.prepare(
      `INSERT INTO audit_logs (admin_user_id, action_type, entity_type, entity_id, changes_json, ip_address) VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(adminId, actionType, entityType, String(entityId || ''), JSON.stringify(changes || {}), ip || '').run();
  } catch (e) {
    console.error('Audit log error:', e);
  }
}

// ============================================================================
// SHARED PUBLIC UI LAYOUT
// ============================================================================
function renderPublicLayout({ title, desc, path, body, type = 'website', img, schema = [], noindex = false }) {
  const canonical = SITE_URL + path;
  return `<!doctype html>
<html lang="bn">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <link rel="canonical" href="${esc(canonical)}">
  ${noindex ? '<meta name="robots" content="noindex,nofollow">' : '<meta name="robots" content="index,follow,max-image-preview:large">'}
  <meta name="theme-color" content="#064e3b">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:type" content="${esc(type)}">
  <meta property="og:url" content="${esc(canonical)}">
  <meta property="og:site_name" content="${SITE_NAME}">
  <meta property="og:locale" content="bn_BD">
  <meta name="twitter:card" content="${img ? 'summary_large_image' : 'summary'}">
  ${SITE_CFG && SITE_CFG.googleVerification ? `<meta name="google-site-verification" content="${esc(SITE_CFG.googleVerification)}">` : ''}
  ${img ? `<meta property="og:image" content="${esc(img.startsWith('http') ? img : SITE_URL + img)}">` : ''}
  <link rel="icon" href="/favicon.svg">
  <link rel="stylesheet" href="/assets/style.css">
  <style>
    main{overflow-wrap:break-word;word-wrap:break-word;word-break:normal}
    .dir-filter{background:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;padding:14px;margin-bottom:20px;display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px}
    .dir-filter input,.dir-filter select{width:100%;padding:9px 12px;border:1px solid #94a3b8;border-radius:6px;font:inherit;font-size:15px;background:#fff}
    .dir-filter button{background:var(--g);color:#fff;border:0;border-radius:6px;padding:9px 16px;font:inherit;font-weight:600;cursor:pointer}
    .inst-list{display:grid;gap:14px}
    .inst-item{border:1px solid #d1fae5;border-radius:10px;padding:16px;background:#fff;display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap}
    .inst-item:hover{border-color:var(--g)}
    .inst-item h3{margin:4px 0 6px;font-size:19px}
    .badge{display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:600;padding:2px 9px;border-radius:12px;white-space:nowrap}
    .badge-verified{background:#dcfce7;color:#166534;border:1px solid #86efac}
    .badge-unverified{background:#fef9c3;color:#854d0e;border:1px solid #fde047}
    .badge-eiin{background:#f1f5f9;color:#0f172a;border:1px solid #cbd5e1;font-family:monospace;font-size:13px}
    .prof-hdr{background:linear-gradient(180deg,#fff 0%,#f0fdf4 100%);border:2px solid var(--g);border-left-width:8px;border-radius:16px;padding:20px;margin-bottom:30px;box-shadow:0 6px 0 var(--g),0 16px 30px -10px rgba(6,78,59,.45)}
    .prof-hdr h1{margin:6px 0 4px;font-size:25px;color:var(--g);line-height:1.4}
    .prof-sub{color:#475569;font-size:16px;margin:0 0 12px}
    .prof-top{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:2px}
    .vbadge{display:inline-block;width:.78em;height:.78em;margin-left:.3em;vertical-align:-.04em;flex:none}
    .nw{white-space:nowrap}
    .prof-actions{display:flex;flex-wrap:wrap;gap:8px;margin:2px 0 4px}
    .act{display:inline-flex;align-items:center;gap:6px;padding:7px 13px;border:1.5px solid var(--g);border-radius:999px;font-size:13.5px;font-weight:600;color:var(--g);background:#fff;line-height:1.2}
    .act:hover{background:var(--l)}
    .act.pri,.act.pri:hover{background:var(--g);color:#fff}
    .prof-latest{display:flex;flex-wrap:wrap;gap:4px 12px;align-items:center;margin-top:12px;padding:9px 13px;background:var(--l);border:1px solid #a7f3d0;border-radius:10px;font-size:14px;color:#064e3b}
    .prof-latest span{color:#047857;font-size:13px}
    .quick-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-top:14px;padding-top:14px;border-top:1px solid #e2e8f0}
    .q-stat{background:#fff;padding:7px 11px;border-radius:8px;border:1px solid #e2e8f0}
    .q-stat small{display:block;color:#64748b;font-size:12px}
    .q-stat strong{font-size:15px;color:#0f172a}
    .toc-nav{display:flex;gap:8px;overflow-x:auto;padding:8px 0;margin-bottom:18px;border-bottom:1px solid #e2e8f0;white-space:nowrap;-webkit-overflow-scrolling:touch}
    .toc-nav a{font-size:14px;padding:5px 12px;border-radius:14px;background:var(--l);color:var(--g);font-weight:600;flex:none}
    /* 3D block cards: dark-green border, raised bottom edge, gradient header bar */
    .prof-sec{position:relative;background:#fff;border:2px solid var(--g);border-radius:16px;overflow:hidden;margin-bottom:32px;padding:0 20px 20px;box-shadow:0 6px 0 var(--g),0 16px 30px -10px rgba(6,78,59,.45);transition:transform .2s ease,box-shadow .2s ease}
    @media(hover:hover){.prof-sec:hover{transform:translateY(-3px);box-shadow:0 9px 0 var(--g),0 22px 36px -10px rgba(6,78,59,.5)}}
    @media(prefers-reduced-motion:reduce){.prof-sec{transition:none}.prof-sec:hover{transform:none}}
    .prof-sec>h2{margin:0 -20px 18px;padding:14px 20px;background:linear-gradient(180deg,#0e7a50 0%,#064e3b 100%);color:#fff;border:0;border-bottom:3px solid #022c22;font-size:20px;line-height:1.4;text-shadow:0 1px 0 rgba(0,0,0,.35);box-shadow:inset 0 1px 0 rgba(255,255,255,.2)}
    .tbl-wrap{width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid #a7f3d0;border-radius:10px;margin:10px 0;box-shadow:0 2px 6px rgba(6,78,59,.08)}
    .data-tbl{width:100%;border-collapse:collapse;font-size:14px;word-break:normal;overflow-wrap:normal}
    .data-tbl th,.data-tbl td{border-bottom:1px solid #e2e8f0;border-right:1px solid #e2e8f0;padding:10px 12px;text-align:left;white-space:nowrap}
    .data-tbl th:last-child,.data-tbl td:last-child{border-right:0}
    .data-tbl tr:last-child th,.data-tbl tr:last-child td{border-bottom:0}
    .data-tbl th{background:#ecfdf5;font-weight:700;color:#064e3b}
    .data-tbl tbody tr:nth-child(even){background:#f7fdf9}
    .rev-box{background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:16px;margin-bottom:14px}
    .src-box{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px;font-size:14px}
    .pag{display:flex;gap:8px;justify-content:center;margin:24px 0;flex-wrap:wrap}
    .pag a,.pag span{padding:6px 13px;border:1px solid #cbd5e1;border-radius:6px;font-size:14px}
    .pag .cur{background:var(--g);color:#fff;border-color:var(--g)}
    @media(max-width:600px){
      .prof-hdr{padding:14px;border-left-width:4px}
      .prof-hdr h1{font-size:21px;margin:8px 0 2px}
      .prof-sub{font-size:14px;margin-bottom:10px}
      .quick-grid{grid-template-columns:1fr 1fr;gap:8px}
      .q-stat.wide{grid-column:1/-1}
      .q-stat strong{font-size:14px;line-height:1.5}
      .prof-actions{gap:6px}
      .act{padding:6px 10px;font-size:12.5px;gap:5px}
      .act svg{width:14px;height:14px}
      .prof-sec{padding:0 14px 16px;box-shadow:0 4px 0 var(--g),0 12px 22px -10px rgba(6,78,59,.45)}.prof-sec>h2{margin:0 -14px 14px;padding:12px 14px;font-size:17px}.prof-hdr{padding:14px}
      .inst-item{padding:12px}
      .data-tbl{font-size:13px}
      .data-tbl th,.data-tbl td{padding:8px 10px}
    }
  </style>
  ${schema.map(s => `<script type="application/ld+json">${JSON.stringify(s)}</script>`).join('')}
  ${SITE_CFG && SITE_CFG.gaHtml ? SITE_CFG.gaHtml : ''}
</head>
<body>
  <header>
    <div class="w hd">
      <a class="logo" href="/">${SITE_NAME}<small>.me</small></a>
      <form action="/institutions/" method="GET" style="flex:1;max-width:320px;margin-left:auto">
        <input id="q" name="q" type="search" placeholder="নাম বা EIIN দিয়ে খুঁজুন..." aria-label="Search">
      </form>
    </div>
    <nav class="w">
      <a href="/">হোম</a>
      <a href="/institutions/">সকল প্রতিষ্ঠান</a>
      <a href="/institutions/schools/">স্কুল</a>
      <a href="/institutions/colleges/">কলেজ</a>
      <a href="/institutions/madrasas/">মাদ্রাসা</a>
      <a href="/institutions/technical/">কারিগরি</a>
      <a href="/institutions/universities/">বিশ্ববিদ্যালয়</a>
      <a href="/results/compare/">ফলাফল তুলনা ও পরিসংখ্যান</a>
      <a href="/emis/">EMIS টুল</a>
    </nav>
  </header>
  <main class="w">${body}</main>
  <footer>
    <div class="w">
      <p><a href="/">হোম</a> · <a href="/institutions/">শিক্ষাপ্রতিষ্ঠান ডিরেক্টরি</a> · <a href="/results/compare/">ফলাফল তুলনা</a> · <a href="/about/">আমাদের সম্পর্কে</a> · <a href="/contact/">যোগাযোগ</a> · <a href="/privacy-policy/">প্রাইভেসি পলিসি</a></p>
      <p>© ${new Date().getFullYear()} ${SITE_NAME}.me — বাংলাদেশ শিক্ষা তথ্য ও শিক্ষাপ্রতিষ্ঠান ডিরেক্টরি</p>
    </div>
  </footer>
</body>
</html>`;
}

// ============================================================================
// PUBLIC DIRECTORY RENDERER (/institutions/*, /districts/*, /upazilas/*)
// ============================================================================
async function handlePublicDirectory(req, env, routeContext) {
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').trim();
  const typeSlug = routeContext.typeSlug || url.searchParams.get('type') || '';
  const divisionSlug = url.searchParams.get('division') || '';
  const districtSlug = routeContext.districtSlug || url.searchParams.get('district') || '';
  const upazilaSlug = routeContext.upazilaSlug || url.searchParams.get('upazila') || '';
  const sort = url.searchParams.get('sort') || 'verified';
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = 20;
  const offset = (page - 1) * limit;

  const [typesRes, divsRes, distsRes, upzsRes] = await Promise.all([
    env.DB.prepare(`SELECT slug, name_bn, name_en, description_bn FROM institution_types ORDER BY display_order ASC`).all(),
    env.DB.prepare(`SELECT slug, name_bn FROM divisions ORDER BY id ASC`).all(),
    env.DB.prepare(`SELECT slug, name_bn, intro_bn FROM districts ORDER BY name_en ASC`).all(),
    env.DB.prepare(`SELECT slug, name_bn, intro_bn FROM upazilas ORDER BY name_en ASC`).all()
  ]);

  let whereClauses = [`i.is_published = 1`];
  let params = [];

  if (q) {
    whereClauses.push(`(i.eiin = ? OR i.name_bn LIKE ? OR i.name_en LIKE ? OR i.normalized_name LIKE ? OR EXISTS (SELECT 1 FROM institution_aliases a WHERE a.institution_id = i.id AND a.normalized_alias LIKE ?))`);
    const nq = `%${normalizeName(q)}%`;
    params.push(q, `%${q}%`, `%${q}%`, nq, nq);
  }
  if (typeSlug) { whereClauses.push(`t.slug = ?`); params.push(typeSlug); }
  if (divisionSlug) { whereClauses.push(`dv.slug = ?`); params.push(divisionSlug); }
  if (districtSlug) { whereClauses.push(`d.slug = ?`); params.push(districtSlug); }
  if (upazilaSlug) { whereClauses.push(`u.slug = ?`); params.push(upazilaSlug); }

  const whereSql = whereClauses.join(' AND ');

  const countRow = await env.DB.prepare(`
    SELECT COUNT(*) as total
    FROM institutions i
    JOIN institution_types t ON i.institution_type_id = t.id
    JOIN divisions dv ON i.division_id = dv.id
    JOIN districts d ON i.district_id = d.id
    JOIN upazilas u ON i.upazila_id = u.id
    WHERE ${whereSql}
  `).bind(...params).first();

  const total = countRow ? countRow.total : 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  let orderBySql = `CASE WHEN i.verification_status = 'verified' THEN 0 ELSE 1 END, i.completeness_score DESC, i.name_en ASC`;
  if (sort === 'name_asc') orderBySql = `i.name_en ASC`;
  if (sort === 'established_asc') orderBySql = `CASE WHEN i.established_year IS NULL THEN 1 ELSE 0 END, i.established_year ASC`;

  const rowsRes = await env.DB.prepare(`
    SELECT i.slug, i.eiin, i.name_bn, i.name_en, i.established_year, i.management_type,
           i.verification_status, i.education_board,
           t.name_bn as type_bn, t.slug as type_slug,
           d.name_bn as district_bn, d.slug as district_slug,
           u.name_bn as upazila_bn, u.slug as upazila_slug
    FROM institutions i
    JOIN institution_types t ON i.institution_type_id = t.id
    JOIN divisions dv ON i.division_id = dv.id
    JOIN districts d ON i.district_id = d.id
    JOIN upazilas u ON i.upazila_id = u.id
    WHERE ${whereSql}
    ORDER BY ${orderBySql}
    LIMIT ? OFFSET ?
  `).bind(...params, limit, offset).all();

  const items = rowsRes.results || [];

  let pageHeading = 'বাংলাদেশ শিক্ষাপ্রতিষ্ঠান ডিরেক্টরি';
  let pageDesc = 'সারা বাংলাদেশের যাচাইকৃত স্কুল, কলেজ, মাদ্রাসা, কারিগরি প্রতিষ্ঠান ও বিশ্ববিদ্যালয়ের EIIN, বোর্ড রেজাল্ট ও ভর্তি তথ্য।';

  if (typeSlug) {
    const tObj = (typesRes.results || []).find(x => x.slug === typeSlug);
    if (tObj) {
      pageHeading = `${tObj.name_bn} ডিরেক্টরি ও তালিকা`;
      pageDesc = tObj.description_bn || `${tObj.name_bn}-এর EIIN নম্বর, ফলাফল, ঠিকানা ও ভর্তি তথ্য।`;
    }
  } else if (districtSlug) {
    const dObj = (distsRes.results || []).find(x => x.slug === districtSlug);
    if (dObj) {
      pageHeading = `${dObj.name_bn} জেলার শিক্ষাপ্রতিষ্ঠানের তালিকা`;
      pageDesc = dObj.intro_bn || `${dObj.name_bn} জেলার সকল স্কুল, কলেজ, মাদ্রাসা ও কারিগরি শিক্ষাপ্রতিষ্ঠানের যাচাইকৃত তালিকা, EIIN এবং ফলাফল।`;
    }
  } else if (upazilaSlug) {
    const uObj = (upzsRes.results || []).find(x => x.slug === upazilaSlug);
    if (uObj) {
      pageHeading = `${uObj.name_bn} উপজেলার শিক্ষাপ্রতিষ্ঠানের তালিকা`;
      pageDesc = uObj.intro_bn || `${uObj.name_bn} উপজেলার সকল স্কুল, কলেজ ও মাদ্রাসার তালিকা।`;
    }
  }

  // District-wise Result Summary if viewing a district page
  let districtStatsHtml = '';
  if (districtSlug) {
    const dStat = await env.DB.prepare(`
      SELECT r.exam_type, r.exam_year,
             COUNT(DISTINCT r.institution_id) as inst_count,
             SUM(r.appeared_students) as total_appeared,
             SUM(r.passed_students) as total_passed,
             SUM(r.gpa5_students) as total_gpa5
      FROM institution_results r
      JOIN institutions i ON r.institution_id = i.id
      JOIN districts d ON i.district_id = d.id
      WHERE d.slug = ? AND r.verification_status = 'verified'
      GROUP BY r.exam_type, r.exam_year
      ORDER BY r.exam_year DESC LIMIT 4
    `).bind(districtSlug).all();

    if ((dStat.results || []).length > 0) {
      districtStatsHtml = `
        <section class="box" style="margin-bottom:20px">
          <h2>${esc(pageHeading)} — বোর্ড ফলাফল পরিসংখ্যান</h2>
          <div class="tbl-wrap">
            <table class="data-tbl">
              <thead><tr><th>পরীক্ষা</th><th>সাল</th><th>প্রতিষ্ঠান সংখ্যা</th><th>মোট পরীক্ষার্থী</th><th>উত্তীর্ণ</th><th>মোট জিপিএ-৫</th><th>গড় পাসের হার</th></tr></thead>
              <tbody>
                ${dStat.results.map(s => {
                  const pr = s.total_appeared > 0 ? ((s.total_passed / s.total_appeared) * 100).toFixed(2) : '0.00';
                  return `<tr><td><strong>${esc(s.exam_type)}</strong></td><td>${esc(s.exam_year)}</td><td>${s.inst_count}</td><td>${s.total_appeared}</td><td>${s.total_passed}</td><td>${s.total_gpa5}</td><td><strong>${pr}%</strong></td></tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </section>
      `;
    }
  }

  const hasQueryParams = Boolean(q || divisionSlug || url.searchParams.get('district') || url.searchParams.get('type') || url.searchParams.get('upazila') || page > 1);
  const shouldNoindex = hasQueryParams || total === 0;

  const listHtml = items.length ? items.map(inst => `
    <article class="inst-item">
      <div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
          <span class="tag">${esc(inst.type_bn)}</span>
          ${inst.eiin ? `<span class="badge badge-eiin">EIIN: ${esc(inst.eiin)}</span>` : ''}
          ${inst.verification_status === 'verified'
            ? `<span class="badge badge-verified">✓ যাচাইকৃত তথ্য</span>`
            : `<span class="badge badge-unverified">তথ্য সংযোজন চলমান</span>`}
        </div>
        <h3><a href="/institution/${esc(inst.slug)}/">${esc(inst.name_bn)}</a></h3>
        <div style="font-size:14px;color:#475569">${esc(inst.name_en)}</div>
        <div class="meta" style="margin-top:6px">
          📍 <a href="/upazilas/${esc(inst.upazila_slug)}/">${esc(inst.upazila_bn)}</a>,
          <a href="/districts/${esc(inst.district_slug)}/">${esc(inst.district_bn)}</a>
          ${inst.established_year ? ` · স্থাপিত: ${esc(inst.established_year)}` : ''}
          ${inst.education_board ? ` · বোর্ড: ${esc(inst.education_board)}` : ''}
        </div>
      </div>
      <div style="align-self:center;display:flex;gap:8px">
        <a href="/results/compare/?a=${esc(inst.slug)}" style="display:inline-block;padding:7px 11px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px">তুলনা করুন</a>
        <a href="/institution/${esc(inst.slug)}/" style="display:inline-block;padding:7px 14px;background:var(--l);color:var(--g);border-radius:6px;font-weight:600;font-size:14px">বিস্তারিত প্রোফাইল →</a>
      </div>
    </article>
  `).join('') : `<div class="box"><p>এই ফিল্টারে কোনো যাচাইকৃত শিক্ষাপ্রতিষ্ঠান পাওয়া যায়নি। অন্য নাম বা EIIN দিয়ে চেষ্টা করুন।</p></div>`;

  const body = `
    <h1>${esc(pageHeading)}</h1>
    <p>${esc(pageDesc)}</p>

    <form class="dir-filter" action="/institutions/" method="GET">
      <input type="search" name="q" value="${esc(q)}" placeholder="নাম বা EIIN নম্বর...">
      <select name="type">
        <option value="">সকল ক্যাটাগরি</option>
        ${(typesRes.results || []).map(t => `<option value="${esc(t.slug)}" ${typeSlug === t.slug ? 'selected' : ''}>${esc(t.name_bn)}</option>`).join('')}
      </select>
      <select name="division">
        <option value="">সকল বিভাগ</option>
        ${(divsRes.results || []).map(v => `<option value="${esc(v.slug)}" ${divisionSlug === v.slug ? 'selected' : ''}>${esc(v.name_bn)}</option>`).join('')}
      </select>
      <select name="district">
        <option value="">সকল জেলা</option>
        ${(distsRes.results || []).map(d => `<option value="${esc(d.slug)}" ${districtSlug === d.slug ? 'selected' : ''}>${esc(d.name_bn)}</option>`).join('')}
      </select>
      <select name="sort">
        <option value="verified" ${sort === 'verified' ? 'selected' : ''}>যাচাইকৃত আগে</option>
        <option value="name_asc" ${sort === 'name_asc' ? 'selected' : ''}>নাম (A-Z)</option>
        <option value="established_asc" ${sort === 'established_asc' ? 'selected' : ''}>প্রতিষ্ঠার সাল</option>
      </select>
      <button type="submit">খুঁজুন</button>
    </form>

    ${districtStatsHtml}

    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;font-size:14px;color:#475569">
      <span>মোট যাচাইকৃত প্রতিষ্ঠান: <strong>${total}</strong> টি</span>
      <span>পৃষ্ঠা ${page} / ${totalPages}</span>
    </div>

    <div class="inst-list">${listHtml}</div>

    ${totalPages > 1 ? `
      <nav class="pag">
        ${page > 1 ? `<a href="?q=${encodeURIComponent(q)}&type=${encodeURIComponent(typeSlug)}&division=${encodeURIComponent(divisionSlug)}&district=${encodeURIComponent(districtSlug)}&sort=${encodeURIComponent(sort)}&page=${page - 1}">« আগের পৃষ্ঠা</a>` : ''}
        <span class="cur">${page}</span>
        ${page < totalPages ? `<a href="?q=${encodeURIComponent(q)}&type=${encodeURIComponent(typeSlug)}&division=${encodeURIComponent(divisionSlug)}&district=${encodeURIComponent(districtSlug)}&sort=${encodeURIComponent(sort)}&page=${page + 1}">পরের পৃষ্ঠা »</a>` : ''}
      </nav>
    ` : ''}
  `;

  return new Response(renderPublicLayout({
    title: `${pageHeading} | ${SITE_NAME}`,
    desc: pageDesc,
    path: url.pathname,
    body,
    noindex: shouldNoindex,
    schema: [{
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'হোম', item: SITE_URL + '/' },
        { '@type': 'ListItem', position: 2, name: 'শিক্ষাপ্রতিষ্ঠান', item: SITE_URL + '/institutions/' },
        { '@type': 'ListItem', position: 3, name: pageHeading, item: SITE_URL + url.pathname }
      ]
    }]
  }), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

// ============================================================================
// TRANSPARENT INSTITUTION COMPARISON & RESULT STATISTICS (/results/compare/)
// ============================================================================
async function handleResultsComparisonPage(req, env) {
  const url = new URL(req.url);
  const slugA = (url.searchParams.get('a') || '').trim();
  const slugB = (url.searchParams.get('b') || '').trim();
  const examType = url.searchParams.get('exam') || 'HSC';

  const [allInstRes, methodRow, boardSummaryRes] = await Promise.all([
    env.DB.prepare(`SELECT id, slug, name_bn, eiin FROM institutions WHERE is_published = 1 ORDER BY name_en ASC LIMIT 200`).all(),
    env.DB.prepare(`SELECT setting_value FROM system_settings WHERE setting_key = 'ranking_methodology_bn'`).first(),
    env.DB.prepare(`
      SELECT exam_type, exam_year, education_board,
             COUNT(DISTINCT institution_id) as inst_count,
             SUM(appeared_students) as appeared,
             SUM(passed_students) as passed,
             SUM(gpa5_students) as gpa5
      FROM institution_results
      WHERE verification_status = 'verified'
      GROUP BY exam_type, exam_year, education_board
      ORDER BY exam_year DESC, exam_type ASC
    `).all()
  ]);

  let compareHtml = '';
  if (slugA && slugB) {
    const [instA, instB] = await Promise.all([
      env.DB.prepare(`SELECT i.*, d.name_bn as district_bn FROM institutions i JOIN districts d ON i.district_id = d.id WHERE i.slug = ?`).bind(slugA).first(),
      env.DB.prepare(`SELECT i.*, d.name_bn as district_bn FROM institutions i JOIN districts d ON i.district_id = d.id WHERE i.slug = ?`).bind(slugB).first()
    ]);

    if (instA && instB) {
      const [resA, resB] = await Promise.all([
        env.DB.prepare(`SELECT * FROM institution_results WHERE institution_id = ? AND exam_type = ? ORDER BY exam_year DESC`).bind(instA.id, examType).all(),
        env.DB.prepare(`SELECT * FROM institution_results WHERE institution_id = ? AND exam_type = ? ORDER BY exam_year DESC`).bind(instB.id, examType).all()
      ]);

      const years = Array.from(new Set([...(resA.results || []).map(r => r.exam_year), ...(resB.results || []).map(r => r.exam_year)])).sort((a, b) => b - a);
      const mismatchWarn = (instA.institution_type_id !== instB.institution_type_id)
        ? `<div style="background:#fef9c3;border:1px solid #fde047;color:#854d0e;padding:10px 14px;border-radius:8px;margin-bottom:12px;font-size:14px"><strong>⚠ অসম প্রতিষ্ঠানের তুলনা:</strong> আপনি দুটি ভিন্ন স্তরের প্রতিষ্ঠানের মধ্যে তুলনা করছেন। স্বচ্ছ ও সঠিক মূল্যায়নের জন্য সমপর্যায়ের প্রতিষ্ঠান (যেমন: স্কুলের সাথে স্কুল অথবা কলেজের সাথে কলেজ) নির্বাচন করুন।</div>`
        : '';

      compareHtml = `
        <section class="prof-sec">
          <h2>তুলনামূলক ফলাফল বিশ্লেষণ (${esc(examType)}): ${esc(instA.name_bn)} বনাম ${esc(instB.name_bn)}</h2>
          ${mismatchWarn}
          <div class="tbl-wrap">
            <table class="data-tbl">
              <thead>
                <tr>
                  <th>মানদণ্ড / সাল</th>
                  <th><a href="/institution/${esc(instA.slug)}/">${esc(instA.name_bn)}</a> (EIIN: ${esc(instA.eiin || 'N/A')})</th>
                  <th><a href="/institution/${esc(instB.slug)}/">${esc(instB.name_bn)}</a> (EIIN: ${esc(instB.eiin || 'N/A')})</th>
                </tr>
              </thead>
              <tbody>
                <tr><th>জেলা ও বোর্ড</th><td>${esc(instA.district_bn)} (${esc(instA.education_board || '-')})</td><td>${esc(instB.district_bn)} (${esc(instB.education_board || '-')})</td></tr>
                <tr><th>প্রতিষ্ঠার সাল ও ধরন</th><td>${esc(instA.established_year || '-')} (${esc(instA.management_type)})</td><td>${esc(instB.established_year || '-')} (${esc(instB.management_type)})</td></tr>
                ${years.map(yr => {
                  const ra = (resA.results || []).find(x => x.exam_year === yr);
                  const rb = (resB.results || []).find(x => x.exam_year === yr);
                  return `
                    <tr>
                      <th>${esc(examType)} ${yr} ফলাফল</th>
                      <td>${ra ? `পরীক্ষার্থী: ${ra.appeared_students} | পাস: ${ra.passed_students} (<strong>${ra.pass_rate}%</strong>) | জিপিএ-৫: <strong>${ra.gpa5_students}</strong> (${ra.gpa5_rate}%)` : 'এই পরীক্ষায় অংশগ্রহণ নেই / তথ্য অপ্রাপ্য'}</td>
                      <td>${rb ? `পরীক্ষার্থী: ${rb.appeared_students} | পাস: ${rb.passed_students} (<strong>${rb.pass_rate}%</strong>) | জিপিএ-৫: <strong>${rb.gpa5_students}</strong> (${rb.gpa5_rate}%)` : 'এই পরীক্ষায় অংশগ্রহণ নেই / তথ্য অপ্রাপ্য'}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </section>
      `;
    }
  }

  const instOptions = (allInstRes.results || []).map(i => `<option value="${esc(i.slug)}">${esc(i.name_bn)} (${esc(i.eiin || 'No EIIN')})</option>`).join('');

  const body = `
    <h1>স্বচ্ছ বোর্ড ফলাফল পরিসংখ্যান ও শিক্ষাপ্রতিষ্ঠান তুলনা</h1>
    <div class="src-box" style="margin-bottom:20px">
      <strong>স্বচ্ছ তুলনা ও মূল্যায়ন পদ্ধতি (Ranking & Comparison Methodology):</strong>
      <p style="margin:6px 0 0">${esc(methodRow?.setting_value || 'একই পরীক্ষা ও একই শিক্ষাবর্ষের যাচাইকৃত বোর্ড ফলাফলের ভিত্তিতে তুলনা করা হয়।')}</p>
    </div>

    <form class="dir-filter" action="/results/compare/" method="GET">
      <select name="a" required>
        <option value="">১ম শিক্ষাপ্রতিষ্ঠান নির্বাচন করুন...</option>
        ${instOptions}
      </select>
      <select name="b" required>
        <option value="">২য় শিক্ষাপ্রতিষ্ঠান নির্বাচন করুন...</option>
        ${instOptions}
      </select>
      <select name="exam">
        <option value="SSC" ${examType === 'SSC' ? 'selected' : ''}>SSC / সমমান</option>
        <option value="HSC" ${examType === 'HSC' ? 'selected' : ''}>HSC / সমমান</option>
        <option value="Dakhil" ${examType === 'Dakhil' ? 'selected' : ''}>Dakhil</option>
        <option value="Alim" ${examType === 'Alim' ? 'selected' : ''}>Alim</option>
      </select>
      <button type="submit">পাশাপাশি তুলনা করুন</button>
    </form>

    ${compareHtml}
  `;

  return new Response(renderPublicLayout({
    title: `শিক্ষাপ্রতিষ্ঠান ফলাফল তুলনা ও বোর্ড পরিসংখ্যান | ${SITE_NAME}`,
    desc: 'বাংলাদেশের স্কুল, কলেজ ও মাদ্রাসার এসএসসি ও এইচএসসি পরীক্ষার ফলাফল, পাসের হার এবং জিপিএ-৫ হারের স্বচ্ছ তুলনা।',
    path: '/results/compare/',
    body,
    noindex: Boolean(slugA || slugB)
  }), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

// ============================================================================
// INSTITUTION PROFILE PAGE RENDERER (With Public User Review Form & Audit Log)
// ============================================================================
async function handleInstitutionProfile(req, env, slug) {
  const inst = await env.DB.prepare(`
    SELECT i.*,
           t.name_bn as type_bn, t.name_en as type_en, t.slug as type_slug,
           dv.name_bn as division_bn, dv.slug as division_slug,
           d.name_bn as district_bn, d.name_en as district_en, d.slug as district_slug,
           u.name_bn as upazila_bn, u.name_en as upazila_en, u.slug as upazila_slug
    FROM institutions i
    JOIN institution_types t ON i.institution_type_id = t.id
    JOIN divisions dv ON i.division_id = dv.id
    JOIN districts d ON i.district_id = d.id
    JOIN upazilas u ON i.upazila_id = u.id
    WHERE i.slug = ?
  `).bind(slug).first();

  if (!inst) return null;

  const [contactsRes, sourcesRes, resultsRes, reviewsRes, verifLogsRes, relatedRes, linkedPostsRes] = await Promise.all([
    env.DB.prepare(`SELECT * FROM institution_contacts WHERE institution_id = ? ORDER BY is_primary DESC`).bind(inst.id).all(),
    env.DB.prepare(`SELECT * FROM institution_sources WHERE institution_id = ? ORDER BY accessed_date DESC`).bind(inst.id).all(),
    env.DB.prepare(`SELECT * FROM institution_results WHERE institution_id = ? ORDER BY exam_year DESC, exam_type ASC`).bind(inst.id).all(),
    env.DB.prepare(`SELECT * FROM institution_reviews WHERE institution_id = ? AND moderation_status = 'approved' ORDER BY review_type ASC, created_at DESC`).bind(inst.id).all(),
    env.DB.prepare(`SELECT * FROM verification_logs WHERE institution_id = ? ORDER BY created_at DESC LIMIT 5`).bind(inst.id).all(),
    env.DB.prepare(`SELECT slug, name_bn, eiin FROM institutions WHERE district_id = ? AND id != ? AND is_published = 1 LIMIT 5`).bind(inst.district_id, inst.id).all(),
    env.DB.prepare(`SELECT slug, title_bn, post_type FROM posts WHERE institution_id = ? AND status = 'published' LIMIT 5`).bind(inst.id).all()
  ]);

  const contacts = contactsRes.results || [];
  const sources = sourcesRes.results || [];
  const results = resultsRes.results || [];
  const reviews = reviewsRes.results || [];
  const verifLogs = verifLogsRes.results || [];
  const linkedPosts = linkedPostsRes.results || [];
  const editorialReviews = reviews.filter(r => r.review_type === 'editorial_analysis');
  const userReviews = reviews.filter(r => r.review_type === 'user_feedback');
  const levels = parseJsonSafe(inst.education_levels);
  const groups = parseJsonSafe(inst.academic_groups);
  const programs = parseJsonSafe(inst.programs_offered);
  const facilities = parseJsonSafe(inst.facilities_json);

  const mgmtMap = {
    government: 'সরকারি (Government)',
    non_government: 'বেসরকারি (Non-Government)',
    mpo: 'এমপিওভুক্ত (MPO Listed)',
    autonomous: 'স্বায়ত্তশাসিত (Autonomous)',
    private: 'প্রাইভেট (Private)',
    unknown: 'যাচাইকৃত নয়'
  };

  const isIndexable = isInstitutionIndexable(inst);

  const seoTitle = inst.seo_title || `${inst.name_bn} (${inst.name_en}) - ${inst.eiin ? `EIIN ${inst.eiin}, ` : ''}ভর্তি, রেজাল্ট ও ঠিকানা | ${SITE_NAME}`;
  const seoDesc = inst.seo_description || `${inst.name_bn} (${inst.name_en}), ${inst.upazila_bn}, ${inst.district_bn}-এর অফিশিয়াল EIIN নম্বর, বোর্ড পরীক্ষার ফলাফল, পাসের হার, ভর্তি তথ্য এবং যোগাযোগের বিস্তারিত প্রোফাইল।`;

  const orgType = /madras|school/i.test(inst.type_slug || '') ? 'School'
    : /college|universit/i.test(inst.type_slug || '') ? 'CollegeOrUniversity'
    : 'EducationalOrganization';
  const sdPhone = contacts.find(c => c.contact_type === 'phone' || c.contact_type === 'hotline');
  const sdEmail = contacts.find(c => c.contact_type === 'email');
  const sdDesc = String(inst.overview_bn || '').replace(/\s+/g, ' ').trim().slice(0, 300) || undefined;
  const schema = [
    {
      '@context': 'https://schema.org',
      '@type': orgType,
      '@id': `${SITE_URL}/institution/${inst.slug}/#org`,
      name: inst.name_en,
      alternateName: inst.name_bn,
      description: sdDesc,
      url: `${SITE_URL}/institution/${inst.slug}/`,
      identifier: inst.eiin || inst.internal_code,
      foundingDate: inst.established_year ? String(inst.established_year) : undefined,
      telephone: sdPhone ? sdPhone.contact_value : undefined,
      email: sdEmail ? sdEmail.contact_value : undefined,
      sameAs: inst.official_website ? [formatExternalUrl(inst.official_website)] : undefined,
      geo: (inst.latitude && inst.longitude) ? { '@type': 'GeoCoordinates', latitude: Number(inst.latitude), longitude: Number(inst.longitude) } : undefined,
      address: {
        '@type': 'PostalAddress',
        streetAddress: inst.address_en || inst.address_bn || inst.upazila_en,
        addressLocality: inst.district_en,
        postalCode: inst.postal_code || undefined,
        addressCountry: 'BD'
      }
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'হোম', item: `${SITE_URL}/` },
        { '@type': 'ListItem', position: 2, name: inst.type_bn, item: `${SITE_URL}/institutions/${inst.type_slug}/` },
        { '@type': 'ListItem', position: 3, name: inst.district_bn, item: `${SITE_URL}/districts/${inst.district_slug}/` },
        { '@type': 'ListItem', position: 4, name: inst.name_bn, item: `${SITE_URL}/institution/${inst.slug}/` }
      ]
    }
  ];

  const body = `

    <!-- A. HEADER SECTION -->
    ${(() => {
      const isVerified = inst.verification_status === 'verified';
      const vIcon = isVerified ? `<svg class="vbadge" viewBox="0 0 24 24" role="img" aria-label="যাচাইকৃত প্রতিষ্ঠান"><title>অফিশিয়াল সোর্স দ্বারা যাচাইকৃত</title><g fill="#1d9bf0"><circle cx="12" cy="12" r="8.4"/><rect x="4.6" y="4.6" width="14.8" height="14.8" rx="3.4"/><rect x="4.6" y="4.6" width="14.8" height="14.8" rx="3.4" transform="rotate(45 12 12)"/></g><path d="M7.9 12.3l2.7 2.7 5.6-5.8" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>` : '';
      const words = String(inst.name_bn || '').trim().split(/\s+/);
      const lastWord = words.pop();
      const h1Html = (words.length ? esc(words.join(' ')) + ' ' : '') + `<span class="nw">${esc(lastWord)}${vIcon}</span>`;
      const phone = contacts.find(c => c.contact_type === 'phone' || c.contact_type === 'hotline');
      const ic = {
        call: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>',
        web: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/></svg>',
        map: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>',
        cmp: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3l4 4-4 4M3 7h18M7 21l-4-4 4-4M21 17H3"/></svg>'
      };
      const latestYear = results.length ? results[0].exam_year : null;
      const latest = latestYear ? results.filter(r => r.exam_year === latestYear).slice(0, 2) : [];
      return `
    <section class="prof-hdr">
      <div class="prof-top">
        <span class="tag">${esc(inst.type_bn)}</span>
        ${isVerified ? '' : `<span class="badge badge-unverified">তথ্য যাচাই প্রক্রিয়াধীন</span>`}
      </div>
      <h1>${h1Html}</h1>
      <p class="prof-sub">${esc(inst.name_en)} — ${esc(inst.upazila_bn)}, ${esc(inst.district_bn)}</p>

      <div class="prof-actions">
        ${phone ? `<a class="act pri" href="tel:${esc(String(phone.contact_value).replace(/[^+\d]/g, ''))}">${ic.call}কল</a>` : ''}
        ${inst.official_website ? `<a class="act" href="${esc(formatExternalUrl(inst.official_website))}" target="_blank" rel="noopener nofollow">${ic.web}ওয়েবসাইট</a>` : ''}
        ${(inst.latitude && inst.longitude) ? `<a class="act" href="https://www.google.com/maps?q=${encodeURIComponent(inst.latitude + ',' + inst.longitude)}" target="_blank" rel="noopener">${ic.map}ম্যাপ</a>` : ''}
        <a class="act" href="/results/compare/?a=${esc(inst.slug)}">${ic.cmp}তুলনা</a>
      </div>

      ${latest.length ? `<a class="prof-latest" href="#results"><span>সর্বশেষ ফলাফল</span>${latest.map(r => `<strong>${esc(r.exam_type)} ${esc(r.exam_year)}: পাস ${esc(r.pass_rate)}%</strong>`).join('')}</a>` : ''}

      <div class="quick-grid">
        <div class="q-stat"><small>EIIN নম্বর</small><strong>${esc(inst.eiin || 'প্রযোজ্য নয়')}</strong></div>
        <div class="q-stat"><small>প্রতিষ্ঠার সাল</small><strong>${esc(inst.established_year || 'যাচাইকৃত নয়')}</strong></div>
        <div class="q-stat"><small>ব্যবস্থাপনা</small><strong title="${esc(mgmtMap[inst.management_type] || '')}">${esc(String(mgmtMap[inst.management_type] || 'অজানা').replace(/\s*\([^)]*\)/g, ''))}</strong></div>
        <div class="q-stat"><small>শিক্ষা বোর্ড</small><strong>${esc(inst.education_board || 'প্রযোজ্য নয়')}</strong></div>
        <div class="q-stat wide"><small>অবস্থান</small><strong><a href="/upazilas/${esc(inst.upazila_slug)}/">${esc(inst.upazila_bn)}</a>, <a href="/districts/${esc(inst.district_slug)}/">${esc(inst.district_bn)}</a></strong></div>
      </div>
    </section>`;
    })()}

    <nav class="toc-nav" aria-label="প্রোফাইল সেকশন নেভিগেশন">
      <a href="#overview">পরিচিতি</a>
      <a href="#academic">একাডেমিক তথ্য</a>
      <a href="#admission">ভর্তি তথ্য</a>
      <a href="#results">বোর্ড ফলাফল</a>
      <a href="#location">ঠিকানা ও যোগাযোগ</a>
      ${inst.history_bn ? `<a href="#history">ইতিহাস</a>` : ''}
      <a href="#reviews">বিশ্লেষণ ও রিভিউ</a>
      <a href="#transparency">তথ্যসূত্র ও সংশোধন</a>
    </nav>

    <div class="grid">
      <div>
        <!-- B. OVERVIEW -->
        <section id="overview" class="prof-sec">
          <h2>প্রতিষ্ঠান পরিচিতি (Overview)</h2>
          <p>${esc(inst.overview_bn || `${inst.name_bn} (${inst.name_en}) ${inst.district_bn} জেলার ${inst.upazila_bn} উপজেলায় অবস্থিত একটি শিক্ষাপ্রতিষ্ঠান।`)}</p>
        </section>

        <!-- C. ACADEMIC INFORMATION -->
        <section id="academic" class="prof-sec">
          <h2>একাডেমিক তথ্য (Academic Information)</h2>
          <div class="tbl-wrap">
            <table class="data-tbl">
              <tbody>
                <tr><th>শিক্ষা স্তর</th><td>${levels.length ? esc(levels.join(', ')) : 'এখনো যাচাই করা হয়নি'}</td></tr>
                <tr><th>বিভাগ / গ্রুপসমূহ</th><td>${groups.length ? esc(groups.join(', ')) : 'প্রযোজ্য নয় বা যাচাইকৃত নয়'}</td></tr>
                <tr><th>চালুকৃত কোর্স / প্রোগ্রাম</th><td>${programs.length ? esc(programs.join(', ')) : 'তথ্য সংযোজন চলমান'}</td></tr>
                <tr><th>শিক্ষার্থীর ধরন</th><td>${inst.gender_type === 'boys' ? 'বালক' : inst.gender_type === 'girls' ? 'বালিকা' : inst.gender_type === 'co-education' ? 'সহশিক্ষা (Co-education)' : 'উল্লেখ নেই'}</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- D. ADMISSION INFORMATION -->
        <section id="admission" class="prof-sec">
          <h2>ভর্তি সংক্রান্ত তথ্য (Admission Information)</h2>
          ${inst.admission_info_bn
            ? formatText(inst.admission_info_bn)
            : `<p>এই প্রতিষ্ঠানের সুনির্দিষ্ট ভর্তি বিজ্ঞপ্তি এখনো ডাটাবেসে যুক্ত হয়নি। সাধারণত শিক্ষা মন্ত্রণালয় ও সংশ্লিষ্ট শিক্ষা বোর্ডের কেন্দ্রীয় নীতিমালা অনুযায়ী ভর্তি কার্যক্রম পরিচালিত হয়।</p>`}
          ${inst.official_admission_url ? `<p><a href="${esc(formatExternalUrl(inst.official_admission_url))}" target="_blank" rel="noopener noreferrer">অফিশিয়াল ভর্তি পোর্টাল দেখুন ↗</a></p>` : ''}
        </section>

        <!-- E. RESULTS AND PERFORMANCE -->
        <section id="results" class="prof-sec">
          <h2>বোর্ড পরীক্ষার ফলাফল ও পরিসংখ্যান (Results & Performance)</h2>
          ${results.length ? `
            <p style="font-size:14px;color:#475569">পাসের হার = (উত্তীর্ণ শিক্ষার্থী ÷ পরীক্ষায় অংশগ্রহণকারী শিক্ষার্থী) × ১০০ এবং জিপিএ-৫ হার = (জিপিএ-৫ প্রাপ্ত শিক্ষার্থী ÷ অংশগ্রহণকারী শিক্ষার্থী) × ১০০ সূত্র অনুযায়ী হিসাবকৃত।</p>
            <div class="tbl-wrap">
              <table class="data-tbl">
                <thead>
                  <tr><th>পরীক্ষা</th><th>সাল</th><th>বোর্ড</th><th>অংশগ্রহণকারী</th><th>উত্তীর্ণ</th><th>অকৃতকার্য</th><th>জিপিএ-৫</th><th>পাসের হার</th><th>জিপিএ-৫ হার</th></tr>
                </thead>
                <tbody>
                  ${results.map(r => `
                    <tr>
                      <td><strong>${esc(r.exam_type)}</strong></td>
                      <td>${esc(r.exam_year)}</td>
                      <td>${esc(r.education_board)}</td>
                      <td>${esc(r.appeared_students)}</td>
                      <td>${esc(r.passed_students)}</td>
                      <td>${esc(r.failed_students)}</td>
                      <td><strong>${esc(r.gpa5_students)}</strong></td>
                      <td><strong>${Number(r.pass_rate).toFixed(2)}%</strong></td>
                      <td>${Number(r.gpa5_rate).toFixed(2)}%</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            <p style="font-size:13px;color:#64748b;margin-top:8px">সূত্র: ${esc(results[0].source_name)} (${results[0].verification_status === 'verified' ? 'যাচাইকৃত' : 'অযাচাইকৃত'})</p>
          ` : `<div class="box"><p>এই প্রতিষ্ঠানের বিগত বছরের বোর্ড ফলাফল এখনো যাচাইকৃত ডাটাবেসে যুক্ত করা হয়নি। কোনো অনুমানভিত্তিক ফলাফল bdresult.me-তে প্রকাশ করা হয় না।</p></div>`}
        </section>

        <!-- F. LOCATION AND CONTACT -->
        <section id="location" class="prof-sec">
          <h2>ঠিকানা ও যোগাযোগ (Location & Contact)</h2>
          <div class="tbl-wrap">
            <table class="data-tbl">
              <tbody>
                <tr><th>পূর্ণ ঠিকানা</th><td>${esc(inst.address_bn || `${inst.upazila_bn}, ${inst.district_bn}`)}</td></tr>
                <tr><th>উপজেলা / থানা</th><td><a href="/upazilas/${esc(inst.upazila_slug)}/">${esc(inst.upazila_bn)}</a></td></tr>
                <tr><th>জেলা</th><td><a href="/districts/${esc(inst.district_slug)}/">${esc(inst.district_bn)}</a> (${esc(inst.division_bn)} বিভাগ)</td></tr>
                ${inst.postal_code ? `<tr><th>পোস্ট কোড</th><td>${esc(inst.postal_code)}</td></tr>` : ''}
                ${inst.official_website ? `<tr><th>অফিশিয়াল ওয়েবসাইট</th><td><a href="${esc(formatExternalUrl(inst.official_website))}" target="_blank" rel="noopener nofollow">${esc(inst.official_website)}</a></td></tr>` : ''}
                ${contacts.map(c => { const v = esc(c.contact_value); const link = c.contact_type === 'email' ? `<a href="mailto:${v}">${v}</a>` : (c.contact_type === 'phone' || c.contact_type === 'hotline') ? `<a href="tel:${esc(String(c.contact_value).replace(/[^+\d]/g, ''))}">${v}</a>` : v; return `<tr><th>${esc(c.label_bn || c.contact_type)}</th><td>${link}</td></tr>`; }).join('')}
              </tbody>
            </table>
          </div>
          ${(inst.latitude && inst.longitude) ? `
            <p style="margin-top:10px;font-size:14px">📍 ভেরিফাইড জিপিএস স্থানাঙ্ক: ${esc(inst.latitude)}, ${esc(inst.longitude)} — <a href="https://www.google.com/maps?q=${encodeURIComponent(inst.latitude + ',' + inst.longitude)}" target="_blank" rel="noopener">গুগল ম্যাপে দেখুন ↗</a></p>
          ` : ''}
        </section>

        <!-- G. INSTITUTION HISTORY -->
        ${inst.history_bn ? `
          <section id="history" class="prof-sec">
            <h2>প্রতিষ্ঠানের ইতিহাস (Institution History)</h2>
            ${formatText(inst.history_bn)}
          </section>
        ` : ''}

        <!-- H. REVIEWS AND EDITORIAL ANALYSIS (Strictly Separated + Public Review Submission) -->
        <section id="reviews" class="prof-sec">
          <h2>সম্পাদকীয় বিশ্লেষণ ও রিভিউ (Editorial Analysis & Reviews)</h2>
          <p style="font-size:13px;color:#475569;margin-bottom:12px"><strong>স্বচ্ছতা নীতিমালা:</strong> ১. অফিশিয়াল যাচাইকৃত তথ্য, ২. bdresult সম্পাদনা পর্ষদের প্রমাণভিত্তিক বিশ্লেষণ এবং ৩. শিক্ষার্থী/অভিভাবকদের ব্যক্তিগত মতামত সম্পূর্ণ আলাদাভাবে চিহ্নিত করা হয়েছে।</p>

          ${editorialReviews.length ? editorialReviews.map(rev => {
            const strengths = parseJsonSafe(rev.strengths_json);
            const limits = parseJsonSafe(rev.limitations_json);
            return `
              <div class="rev-box">
                <span class="badge badge-verified">সম্পাদকীয় বিশ্লেষণ — ${esc(rev.author_name)}</span>
                <h3 style="margin:8px 0">${esc(rev.title_bn || 'একাডেমিক ও প্রাতিষ্ঠানিক মূল্যায়ন')}</h3>
                ${rev.academic_analysis_bn ? `<p><strong>একাডেমিক ফলাফল বিশ্লেষণ:</strong> ${esc(rev.academic_analysis_bn)}</p>` : ''}
                ${rev.facilities_analysis_bn ? `<p><strong>অবকাঠামো ও সুযোগ-সুবিধা:</strong> ${esc(rev.facilities_analysis_bn)}</p>` : ''}
                ${rev.accessibility_notes_bn ? `<p><strong>অবস্থান ও যাতায়াত:</strong> ${esc(rev.accessibility_notes_bn)}</p>` : ''}
                ${strengths.length ? `<p><strong>প্রমাণভিত্তিক ইতিবাচক দিক:</strong></p><ul>${strengths.map(s => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}
                ${limits.length ? `<p><strong>সীমাবদ্ধতা:</strong></p><ul>${limits.map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
                ${rev.overall_assessment_bn ? `<p><strong>সার্বিক মূল্যায়ন:</strong> ${esc(rev.overall_assessment_bn)}</p>` : ''}
              </div>
            `;
          }).join('') : `<p>এই প্রতিষ্ঠানের বিস্তারিত সম্পাদকীয় বিশ্লেষণ এখনো প্রকাশিত হয়নি।</p>`}

          ${facilities.length ? `
            <h3>যাচাইকৃত সুযোগ-সুবিধা</h3>
            <ul>${facilities.map(f => `<li>${esc(f)}</li>`).join('')}</ul>
          ` : ''}

          <h3>শিক্ষার্থী ও অভিভাবকদের মতামত (User-Submitted Feedback)</h3>
          ${userReviews.length ? userReviews.map(ur => `
            <div class="rev-box" style="background:#fff">
              <span class="badge badge-unverified">পাঠকের মতামত (${esc(ur.author_role || 'সাধারণ')}) — ${esc(ur.author_name)}</span>
              <p style="margin:8px 0 0">${esc(ur.overall_assessment_bn)}</p>
            </div>
          `).join('') : `<p style="font-size:14px;color:#64748b">এখনো কোনো পাঠকের মতামত প্রকাশিত হয়নি।</p>`}

          <details style="margin-top:12px;border:1px solid #cbd5e1;border-radius:8px;padding:12px;background:#fff">
            <summary style="cursor:pointer;font-weight:700;color:var(--g)">+ শিক্ষার্থী বা অভিভাবক হিসেবে আপনার অভিজ্ঞতা জমা দিন (মডারেশন সাপেক্ষে)</summary>
            <form class="cf" style="margin-top:10px" onsubmit="return submitUserFeedback(event, ${inst.id})">
              <input type="text" name="author_name" required placeholder="আপনার নাম *">
              <input type="text" name="author_role" required placeholder="আপনার পরিচয় (বর্তমান শিক্ষার্থী / প্রাক্তন শিক্ষার্থী / অভিভাবক) *">
              <textarea name="overall_assessment_bn" rows="3" required placeholder="প্রতিষ্ঠানের পাঠদান, পরিবেশ ও সুযোগ-সুবিধা সম্পর্কে আপনার বস্তুনিষ্ঠ অভিজ্ঞতা লিখুন *"></textarea>
              <button type="submit">মতামত জমা দিন</button>
              <p id="revMsg" style="font-size:14px;margin-top:8px"></p>
            </form>
          </details>
        </section>

        <!-- I. TRANSPARENCY, VERIFICATION HISTORY & CORRECTION REQUEST -->
        <section id="transparency" class="prof-sec">
          <h2>তথ্যসূত্র, যাচাইকরণ ইতিহাস ও তথ্য সংশোধন (Transparency & Corrections)</h2>
          <div class="src-box">
            <p style="margin:0 0 8px"><strong>সর্বশেষ তথ্য যাচাইয়ের তারিখ:</strong> ${esc(inst.last_verified_at ? inst.last_verified_at.slice(0, 10) : 'প্রক্রিয়াধীন')}</p>
            <strong>ব্যবহৃত অফিশিয়াল তথ্যসূত্রসমূহ:</strong>
            ${sources.length ? `
              <ul style="margin:6px 0 0">
                ${sources.map(s => `<li><strong>${esc(s.source_name)}</strong> (${esc(s.covered_fields || 'সাধারণ তথ্য')}) — সংগৃহীত: ${esc(s.accessed_date)} ${s.source_url ? `<a href="${esc(formatExternalUrl(s.source_url))}" target="_blank" rel="noopener nofollow">[লিংক]</a>` : ''}</li>`).join('')}
              </ul>
            ` : `<p style="margin:4px 0 0">ব্যানবেইস (BANBEIS) ও সংশ্লিষ্ট শিক্ষা বোর্ডের পাবলিক ডিরেক্টরি।</p>`}
            ${verifLogs.length ? `
              <p style="margin:10px 0 4px"><strong>ডাটা পরিবর্তন ও ভেরিফিকেশন লগ (Change History):</strong></p>
              <ul style="margin:0;font-size:13px">
                ${verifLogs.map(vl => `<li>${esc(vl.created_at.slice(0, 10))}: স্ট্যাটাস <em>${esc(vl.new_status)}</em> — ${esc(vl.verified_fields_summary)}</li>`).join('')}
              </ul>
            ` : ''}
          </div>

          <details style="margin-top:16px;border:1px solid #cbd5e1;border-radius:8px;padding:12px;background:#fff">
            <summary style="cursor:pointer;font-weight:700;color:var(--g)">✎ এই পাতায় কোনো ভুল বা পুরনো তথ্য থাকলে সংশোধনের অনুরোধ পাঠান</summary>
            <form id="corrForm" class="cf" style="margin-top:12px" onsubmit="return submitCorrection(event, ${inst.id})">
              <input type="text" name="requester_name" required placeholder="আপনার নাম *">
              <input type="email" name="requester_email" placeholder="আপনার ইমেইল (ঐচ্ছিক)">
              <input type="text" name="requester_relation" required placeholder="প্রতিষ্ঠানের সাথে সম্পর্ক (শিক্ষক / শিক্ষার্থী / অভিভাবক / অন্যান্য) *">
              <input type="text" name="field_name" required placeholder="কোন তথ্যটি সংশোধন করতে চান? (যেমন: EIIN, ঠিকানা, ফলাফল) *">
              <textarea name="proposed_value" rows="2" required placeholder="সঠিক তথ্যটি লিখুন *"></textarea>
              <textarea name="evidence_description" rows="2" required placeholder="তথ্যসূত্র বা প্রমাণ (যেমন: বোর্ড নোটিশ লিংক বা অফিশিয়াল ওয়েবসাইট) *"></textarea>
              <button type="submit">সংশোধনের অনুরোধ জমা দিন</button>
              <p id="corrMsg" style="font-size:14px;margin-top:8px"></p>
            </form>
          </details>
        </section>
      </div>

      <!-- SIDEBAR -->
      <aside>
        ${linkedPosts.length ? `
          <section class="box">
            <h2>এই প্রতিষ্ঠান সম্পর্কিত গাইড ও নোটিশ</h2>
            <ul>
              ${linkedPosts.map(lp => `<li><a href="/${esc(lp.slug)}/">${esc(lp.title_bn)}</a></li>`).join('')}
            </ul>
          </section>
        ` : ''}
        <section class="box">
          <h2>${esc(inst.district_bn)} জেলার অন্যান্য প্রতিষ্ঠান</h2>
          <ul>
            ${(relatedRes.results || []).map(r => `<li><a href="/institution/${esc(r.slug)}/">${esc(r.name_bn)} ${r.eiin ? `(EIIN: ${esc(r.eiin)})` : ''}</a></li>`).join('') || '<li>আরও প্রতিষ্ঠান যুক্ত হচ্ছে</li>'}
          </ul>
          <p style="margin-top:10px;font-size:14px"><a href="/districts/${esc(inst.district_slug)}/">${esc(inst.district_bn)} জেলার সকল প্রতিষ্ঠান দেখুন →</a></p>
        </section>
        <section class="box">
          <h2>দ্রুত লিংক</h2>
          <ul>
            <li><a href="/results/compare/?a=${esc(inst.slug)}">ফলাফল তুলনা করুন</a></li>
            <li><a href="/institutions/schools/">সকল স্কুল ডিরেক্টরি</a></li>
            <li><a href="/institutions/colleges/">সকল কলেজ ডিরেক্টরি</a></li>
            <li><a href="/institutions/madrasas/">সকল মাদ্রাসা ডিরেক্টরি</a></li>
            <li><a href="/emis/">EMIS EIIN শিক্ষক তালিকা</a></li>
          </ul>
        </section>
      </aside>
    </div>

    <script>
      async function submitCorrection(e, instId) {
        e.preventDefault();
        const f = e.target;
        const msg = document.getElementById('corrMsg');
        msg.textContent = 'জমা দেওয়া হচ্ছে...';
        try {
          const payload = {
            institution_id: instId,
            requester_name: f.requester_name.value,
            requester_email: f.requester_email.value,
            requester_relation: f.requester_relation.value,
            field_name: f.field_name.value,
            proposed_value: f.proposed_value.value,
            evidence_description: f.evidence_description.value
          };
          const r = await fetch('/api/corrections', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const j = await r.json();
          if (r.ok) {
            msg.style.color = '#064e3b';
            msg.textContent = 'ধন্যবাদ! আপনার সংশোধনের অনুরোধটি ভেরিফিকেশন কিউতে জমা হয়েছে।';
            f.reset();
          } else {
            msg.style.color = '#b91c1c';
            msg.textContent = j.error || 'জমা দিতে সমস্যা হয়েছে।';
          }
        } catch {
          msg.style.color = '#b91c1c';
          msg.textContent = 'নেটওয়ার্ক ত্রুটি। আবার চেষ্টা করুন।';
        }
        return false;
      }

      async function submitUserFeedback(e, instId) {
        e.preventDefault();
        const f = e.target;
        const msg = document.getElementById('revMsg');
        msg.textContent = 'মতামত জমা দেওয়া হচ্ছে...';
        try {
          const r = await fetch('/api/reviews', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              institution_id: instId,
              author_name: f.author_name.value,
              author_role: f.author_role.value,
              overall_assessment_bn: f.overall_assessment_bn.value
            })
          });
          const j = await r.json();
          if (r.ok) {
            msg.style.color = '#064e3b';
            msg.textContent = 'ধন্যবাদ! আপনার মতামত মডারেশন কিউতে জমা হয়েছে। যাচাই শেষে প্রকাশিত হবে।';
            f.reset();
          } else {
            msg.style.color = '#b91c1c';
            msg.textContent = j.error || 'জমা দিতে সমস্যা হয়েছে।';
          }
        } catch {
          msg.style.color = '#b91c1c';
          msg.textContent = 'নেটওয়ার্ক ত্রুটি।';
        }
        return false;
      }
    </script>
  `;

  return new Response(renderPublicLayout({
    title: seoTitle,
    desc: seoDesc,
    path: `/institution/${inst.slug}/`,
    body,
    schema,
    noindex: !isIndexable
  }), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

// ============================================================================
// DATABASE-DRIVEN POSTS & ARTICLES RENDERER (Section 10 - New DB Posts)
// ============================================================================
async function handleDynamicDatabasePost(env, slug) {
  const post = await env.DB.prepare(`
    SELECT p.*, c.name_bn as category_bn, c.slug as category_slug
    FROM posts p
    LEFT JOIN post_categories c ON p.category_id = c.id
    WHERE p.slug = ? AND p.status = 'published'
  `).bind(slug).first();

  if (!post) return null;

  const relRes = await env.DB.prepare(
    `SELECT slug, title_bn, published_at FROM posts WHERE status = 'published' AND id != ? ORDER BY published_at DESC LIMIT 4`
  ).bind(post.id).all();

  const schemaType = post.post_type === 'education_news' ? 'NewsArticle' : 'Article';
  const urlPath = `/${post.slug}/`;
  const schema = [
    {
      '@context': 'https://schema.org',
      '@type': schemaType,
      headline: post.title_bn,
      description: post.meta_description || post.excerpt_bn || post.title_bn,
      image: post.featured_image ? [post.featured_image.startsWith('http') ? post.featured_image : SITE_URL + post.featured_image] : undefined,
      datePublished: post.published_at || post.created_at,
      dateModified: post.updated_at || post.created_at,
      author: { '@type': 'Organization', name: post.author_name || SITE_NAME },
      publisher: { '@type': 'Organization', name: SITE_NAME },
      mainEntityOfPage: SITE_URL + urlPath
    }
  ];

  const body = `
    <div class="grid">
      <article class="post">
        <h1>${esc(post.title_bn)}</h1>
        <p class="meta">প্রকাশিত: ${esc((post.published_at || post.created_at || '').slice(0, 10))} · লেখক: ${esc(post.author_name || 'bdresult ডেস্ক')}</p>
        ${post.featured_image ? `<img src="${esc(post.featured_image)}" alt="${esc(post.featured_image_alt || post.title_bn)}" width="800" height="450">` : ''}
        <div>${renderPostBody(post.content_html || post.content_markdown)}</div>
        ${(relRes.results || []).length ? `
          <h2>আরও পড়ুন</h2>
          <ul>${relRes.results.map(r => `<li><a href="/${esc(r.slug)}/">${esc(r.title_bn)}</a></li>`).join('')}</ul>
        ` : ''}
      </article>
      <aside>
        <section class="box">
          <h2>শিক্ষাপ্রতিষ্ঠান ডিরেক্টরি</h2>
          <ul>
            <li><a href="/institutions/">সকল শিক্ষাপ্রতিষ্ঠান</a></li>
            <li><a href="/results/compare/">ফলাফল তুলনা করুন</a></li>
          </ul>
        </section>
      </aside>
    </div>
  `;

  return new Response(renderPublicLayout({
    title: `${post.seo_title || post.title_bn} | ${SITE_NAME}`,
    desc: post.meta_description || post.excerpt_bn || post.title_bn,
    path: urlPath,
    type: 'article',
    img: post.featured_image,
    body,
    schema
  }), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

// ============================================================================
// DYNAMIC SITEMAP FOR VERIFIED INSTITUTIONS & DB POSTS (/sitemap-institutions.xml)
// ============================================================================
async function handleInstitutionSitemap(env, url) {
  const headers = { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' };
  const countRow = await env.DB.prepare(`SELECT COUNT(*) AS n FROM institutions i WHERE ${INDEXABLE_SQL}`).first();
  const total = countRow ? Number(countRow.n) : 0;
  const pages = Math.max(1, Math.ceil(total / SITEMAP_PAGE_SIZE));
  const pageParam = parseInt(url.searchParams.get('page') || '0', 10);

  // Very large directories: this URL becomes a sitemap index of ?page=N files (Google limit: 50,000 URLs per file)
  if (pages > 1 && !pageParam) {
    const items = Array.from({ length: pages }, (_, i) => `<sitemap><loc>${SITE_URL}/sitemap-institutions.xml?page=${i + 1}</loc></sitemap>`).join('');
    return new Response(`<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}</sitemapindex>`, { headers });
  }

  const page = pageParam > 0 ? pageParam : 1;
  const instRes = await env.DB.prepare(
    `SELECT i.slug, i.updated_at FROM institutions i WHERE ${INDEXABLE_SQL} ORDER BY i.id LIMIT ? OFFSET ?`
  ).bind(SITEMAP_PAGE_SIZE, (page - 1) * SITEMAP_PAGE_SIZE).all();

  const urls = [];
  for (const r of (instRes.results || [])) {
    const lastmod = String(r.updated_at || '').slice(0, 10);
    urls.push(`<url><loc>${SITE_URL}/institution/${esc(r.slug)}/</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`);
  }

  if (page === 1) {
    const [distRes, upzRes, dbPostsRes] = await Promise.all([
      env.DB.prepare(`SELECT DISTINCT d.slug FROM districts d JOIN institutions i ON i.district_id = d.id WHERE ${INDEXABLE_SQL}`).all(),
      env.DB.prepare(`SELECT DISTINCT u.slug FROM upazilas u JOIN institutions i ON i.upazila_id = u.id WHERE ${INDEXABLE_SQL}`).all(),
      env.DB.prepare(`SELECT slug, updated_at FROM posts WHERE status = 'published' AND is_legacy_markdown = 0`).all()
    ]);
    urls.push(`<url><loc>${SITE_URL}/results/compare/</loc></url>`);
    for (const d of (distRes.results || [])) urls.push(`<url><loc>${SITE_URL}/districts/${esc(d.slug)}/</loc></url>`);
    for (const u of (upzRes.results || [])) urls.push(`<url><loc>${SITE_URL}/upazilas/${esc(u.slug)}/</loc></url>`);
    for (const p of (dbPostsRes.results || [])) {
      const lastmod = String(p.updated_at || '').slice(0, 10);
      urls.push(`<url><loc>${SITE_URL}/${esc(p.slug)}/</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`);
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`;
  return new Response(xml, { headers });
}

// ============================================================================
// ADMIN API HANDLER (/api/admin/*) - ALL 21 MODULES
// ============================================================================
// Optional phone + email (both optional; empty value removes the contact)
async function saveInstitutionContacts(env, instId, b) {
  if (b.contact_phone === undefined && b.contact_email === undefined) return;
  const items = [['phone', 'ফোন', b.contact_phone], ['email', 'ইমেইল', b.contact_email]];
  for (const [type, label, raw] of items) {
    const val = String(raw || '').trim();
    await env.DB.prepare(`DELETE FROM institution_contacts WHERE institution_id = ? AND contact_type = ?`).bind(instId, type).run();
    if (val) {
      await env.DB.prepare(`INSERT INTO institution_contacts (institution_id, contact_type, contact_value, label_bn, is_primary) VALUES (?, ?, ?, ?, 1)`).bind(instId, type, val, label).run();
    }
  }
}

async function handleAdminApi(req, env, path) {
  const admin = await authenticateAdmin(req, env);
  if (!admin) {
    return jsonResponse({ error: 'অনুমতি নেই। অনুগ্রহ করে GitHub OAuth টোকেন দিয়ে লগইন করুন।' }, 401);
  }
  const ip = req.headers.get('CF-Connecting-IP') || '';

  // MODULE 1: Overview
  if (path === '/api/admin/overview' && req.method === 'GET') {
    const [
      totalInst, verifiedInst, pendingInst, byCat, byDist,
      pubPosts, draftPosts, pendingCorr, recentLogs,
      typesList, divsList, distsList, upzsList, postCatsList, importJobsList, settingsList
    ] = await Promise.all([
      env.DB.prepare(`SELECT COUNT(*) as c FROM institutions`).first(),
      env.DB.prepare(`SELECT COUNT(*) as c FROM institutions WHERE verification_status = 'verified'`).first(),
      env.DB.prepare(`SELECT COUNT(*) as c FROM institutions WHERE verification_status IN ('unverified', 'pending_review')`).first(),
      env.DB.prepare(`SELECT t.id, t.slug, t.name_bn, t.name_en, COUNT(i.id) as count FROM institution_types t LEFT JOIN institutions i ON i.institution_type_id = t.id GROUP BY t.id ORDER BY t.display_order ASC`).all(),
      env.DB.prepare(`SELECT d.name_bn, COUNT(i.id) as count FROM districts d LEFT JOIN institutions i ON i.district_id = d.id GROUP BY d.id HAVING count > 0 ORDER BY count DESC LIMIT 12`).all(),
      env.DB.prepare(`SELECT COUNT(*) as c FROM posts WHERE status = 'published'`).first(),
      env.DB.prepare(`SELECT COUNT(*) as c FROM posts WHERE status = 'draft'`).first(),
      env.DB.prepare(`SELECT COUNT(*) as c FROM correction_requests WHERE status = 'pending'`).first(),
      env.DB.prepare(`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 30`).all(),
      env.DB.prepare(`SELECT * FROM institution_types ORDER BY display_order ASC`).all(),
      env.DB.prepare(`SELECT * FROM divisions ORDER BY id ASC`).all(),
      env.DB.prepare(`SELECT * FROM districts ORDER BY name_en ASC`).all(),
      env.DB.prepare(`SELECT * FROM upazilas ORDER BY name_en ASC`).all(),
      env.DB.prepare(`SELECT * FROM post_categories ORDER BY id ASC`).all(),
      env.DB.prepare(`SELECT * FROM import_jobs ORDER BY created_at DESC LIMIT 15`).all(),
      env.DB.prepare(`SELECT * FROM system_settings`).all()
    ]);

    return jsonResponse({
      admin,
      stats: {
        total_institutions: totalInst?.c || 0,
        verified_institutions: verifiedInst?.c || 0,
        pending_verification: pendingInst?.c || 0,
        published_posts: pubPosts?.c || 0,
        draft_posts: draftPosts?.c || 0,
        pending_corrections: pendingCorr?.c || 0
      },
      by_category: byCat.results || [],
      by_district: byDist.results || [],
      recent_logs: recentLogs.results || [],
      import_jobs: importJobsList.results || [],
      settings: settingsList.results || [],
      reference: {
        types: typesList.results || [],
        divisions: divsList.results || [],
        districts: distsList.results || [],
        upazilas: upzsList.results || [],
        post_categories: postCatsList.results || []
      }
    });
  }

  // MODULE 2 & 3 & 14: Institution Management, Add/Edit & Bulk Verification Actions
  if (path === '/api/admin/institution-contacts' && req.method === 'GET') {
    const iid = new URL(req.url).searchParams.get('id');
    const c = await env.DB.prepare(`SELECT contact_type, contact_value FROM institution_contacts WHERE institution_id = ? AND contact_type IN ('phone','email') ORDER BY is_primary DESC, id ASC`).bind(iid).all();
    const rows = c.results || [];
    return jsonResponse({
      phone: (rows.find(r => r.contact_type === 'phone') || {}).contact_value || '',
      email: (rows.find(r => r.contact_type === 'email') || {}).contact_value || ''
    });
  }

  if (path === '/api/admin/institution-sources' && req.method === 'GET') { const iid = new URL(req.url).searchParams.get('id'); const s = await env.DB.prepare('SELECT * FROM institution_sources WHERE institution_id = ?').bind(iid).all(); return jsonResponse({ sources: s.results || [] }); }
  if (path === '/api/admin/institutions' && req.method === 'GET') {
    const url = new URL(req.url);
    const q = (url.searchParams.get('q') || '').trim();
    const status = url.searchParams.get('status') || '';
    let sql = `
      SELECT i.*, t.name_bn as type_bn, d.name_bn as district_bn, u.name_bn as upazila_bn
      FROM institutions i
      LEFT JOIN institution_types t ON i.institution_type_id = t.id
      LEFT JOIN districts d ON i.district_id = d.id
      LEFT JOIN upazilas u ON i.upazila_id = u.id
      WHERE 1=1
    `;
    let binds = [];
    if (q) {
      sql += ` AND (i.eiin = ? OR i.name_bn LIKE ? OR i.name_en LIKE ?)`;
      binds.push(q, `%${q}%`, `%${q}%`);
    }
    if (status) {
      sql += ` AND i.verification_status = ?`;
      binds.push(status);
    }
    sql += ` ORDER BY i.updated_at DESC LIMIT 200`;
    const rows = await env.DB.prepare(sql).bind(...binds).all();
    return jsonResponse({ institutions: rows.results || [] });
  }

  if (path === '/api/admin/institutions/bulk' && req.method === 'POST') {
    const b = await req.json();
    const ids = Array.isArray(b.ids) ? b.ids.map(x => parseInt(x, 10)).filter(Boolean) : [];
    if (!ids.length) return jsonResponse({ error: 'কোনো প্রতিষ্ঠান সিলেক্ট করা হয়নি।' }, 400);

    for (const id of ids) {
      if (b.action === 'verify_publish') {
        await env.DB.prepare(`UPDATE institutions SET verification_status = 'verified', is_published = 1, last_verified_at = datetime('now'), verified_by_admin_id = ?, updated_at = datetime('now') WHERE id = ?`).bind(admin.id, id).run();
        await env.DB.prepare(`INSERT INTO verification_logs (institution_id, admin_user_id, previous_status, new_status, verified_fields_summary) VALUES (?, ?, 'pending_review', 'verified', 'অ্যাডমিন বাল্ক ভেরিফিকেশন ও পাবলিশ')`).bind(id, admin.id).run();
      } else if (b.action === 'unpublish') {
        await env.DB.prepare(`UPDATE institutions SET is_published = 0, updated_at = datetime('now') WHERE id = ?`).bind(id).run();
      } else if (b.action === 'delete' && admin.role === 'super_admin') {
        await env.DB.prepare(`DELETE FROM institutions WHERE id = ?`).bind(id).run();
      }
    }
    await logAudit(env, admin.id, 'BULK_INSTITUTION_' + b.action, 'institutions', ids.join(','), { count: ids.length }, ip);
    return jsonResponse({ ok: true, count: ids.length });
  }

  if (path === '/api/admin/institutions' && req.method === 'POST') {
    const b = await req.json();
    if (!b.name_en || !b.name_bn || !b.institution_type_id || !b.division_id || !b.district_id || !b.upazila_id) {
      return jsonResponse({ error: 'বাংলা নাম, ইংরেজি নাম, ক্যাটাগরি, বিভাগ, জেলা এবং উপজেলা আবশ্যক।' }, 400);
    }

    const eiin = b.eiin ? String(b.eiin).trim() : null;
    const normName = normalizeName(b.name_en);

    const dupCheck = await env.DB.prepare(
      `SELECT id, name_bn, eiin FROM institutions WHERE (eiin IS NOT NULL AND eiin = ?) OR (normalized_name = ? AND district_id = ?)`
    ).bind(eiin || '__NONE__', normName, b.district_id).first();

    if (dupCheck && (!b.id || Number(b.id) !== Number(dupCheck.id))) {
      return jsonResponse({
        error: `ডুপ্লিকেট প্রতিষ্ঠান পাওয়া গেছে: ${dupCheck.name_bn} (ID: ${dupCheck.id}, EIIN: ${dupCheck.eiin || 'N/A'})`
      }, 409);
    }

    const slug = b.slug ? slugify(b.slug) : slugify(b.name_en + (eiin ? '-' + eiin : ''));
    const internalCode = b.internal_code || ('BDR-' + Date.now().toString().slice(-6));
    const score = calculateCompleteness(b);
    const isVerified = b.verification_status === 'verified';

    const parseCommaList = (v) => Array.isArray(v) ? v : String(v || '').split(',').map(x => x.trim()).filter(Boolean);

    if (b.id) {
      await env.DB.prepare(`
        UPDATE institutions SET
          eiin = ?, slug = ?, name_en = ?, name_bn = ?, normalized_name = ?,
          institution_type_id = ?, division_id = ?, district_id = ?, upazila_id = ?,
          address_bn = ?, address_en = ?, postal_code = ?, latitude = ?, longitude = ?,
          established_year = ?, management_type = ?, gender_type = ?, education_board = ?,
          education_levels = ?, academic_groups = ?, programs_offered = ?, facilities_json = ?,
          overview_bn = ?, history_bn = ?, admission_info_bn = ?, official_website = ?,
          verification_status = ?, is_published = ?, completeness_score = ?,
          last_verified_at = CASE WHEN ? = 1 THEN datetime('now') ELSE last_verified_at END,
          seo_title = ?, seo_description = ?, updated_at = datetime('now')
        WHERE id = ?
      `).bind(
        eiin, slug, b.name_en, b.name_bn, normName,
        b.institution_type_id, b.division_id, b.district_id, b.upazila_id,
        b.address_bn || null, b.address_en || null, b.postal_code || null, b.latitude || null, b.longitude || null,
        b.established_year || null, b.management_type || 'unknown', b.gender_type || 'unknown', b.education_board || null,
        JSON.stringify(parseCommaList(b.education_levels)),
        JSON.stringify(parseCommaList(b.academic_groups)),
        JSON.stringify(parseCommaList(b.programs_offered)),
        JSON.stringify(parseCommaList(b.facilities_json)),
        b.overview_bn || null, b.history_bn || null, b.admission_info_bn || null, b.official_website || null,
        b.verification_status || 'unverified', b.is_published ? 1 : 0, score,
        isVerified ? 1 : 0, b.seo_title || null, b.seo_description || null, b.id
      ).run();

      await env.DB.prepare(
        `INSERT INTO verification_logs (institution_id, admin_user_id, new_status, verified_fields_summary, source_reference) VALUES (?, ?, ?, ?, ?)`
      ).bind(b.id, admin.id, b.verification_status || 'unverified', 'প্রোফাইল তথ্য হালনাগাদ ও যাচাই', b.source_name || 'Admin Edit').run();

            if (Array.isArray(b.sources)) {
        await env.DB.prepare(`DELETE FROM institution_sources WHERE institution_id = ?`).bind(b.id).run();
        for (const s of b.sources) {
          if (s.source_name) {
            await env.DB.prepare(
              `INSERT INTO institution_sources (institution_id, source_name, source_url, covered_fields, accessed_date) VALUES (?, ?, ?, ?, date('now'))`
            ).bind(b.id, s.source_name.trim(), formatExternalUrl(s.source_url) || null, (s.covered_fields || 'প্রোফাইল তথ্য').trim()).run();
          }
        }
      }
      await saveInstitutionContacts(env, b.id, b);
      await logAudit(env, admin.id, 'UPDATE_INSTITUTION', 'institutions', b.id, { slug, eiin }, ip);
      return jsonResponse({ ok: true, id: b.id, slug });
    } else {
      const res = await env.DB.prepare(`
        INSERT INTO institutions (
          internal_code, eiin, slug, name_en, name_bn, normalized_name,
          institution_type_id, division_id, district_id, upazila_id,
          address_bn, address_en, postal_code, latitude, longitude,
          established_year, management_type, gender_type, education_board,
          education_levels, academic_groups, programs_offered, facilities_json,
          overview_bn, history_bn, admission_info_bn, official_website,
          verification_status, is_published, completeness_score,
          last_verified_at, verified_by_admin_id, seo_title, seo_description
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        internalCode, eiin, slug, b.name_en, b.name_bn, normName,
        b.institution_type_id, b.division_id, b.district_id, b.upazila_id,
        b.address_bn || null, b.address_en || null, b.postal_code || null, b.latitude || null, b.longitude || null,
        b.established_year || null, b.management_type || 'unknown', b.gender_type || 'unknown', b.education_board || null,
        JSON.stringify(parseCommaList(b.education_levels)),
        JSON.stringify(parseCommaList(b.academic_groups)),
        JSON.stringify(parseCommaList(b.programs_offered)),
        JSON.stringify(parseCommaList(b.facilities_json)),
        b.overview_bn || null, b.history_bn || null, b.admission_info_bn || null, b.official_website || null,
        b.verification_status || 'unverified', b.is_published ? 1 : 0, score,
        isVerified ? new Date().toISOString() : null, isVerified ? admin.id : null,
        b.seo_title || null, b.seo_description || null
      ).run();

      const newId = res.meta?.last_row_id;
      const srcList = Array.isArray(b.sources) && b.sources.length ? b.sources : (b.source_name ? [{ source_name: b.source_name, source_url: b.source_url, covered_fields: 'প্রাথমিক প্রোফাইল তথ্য' }] : []);
      for (const s of srcList) {
        if (s.source_name) {
          await env.DB.prepare(
            `INSERT INTO institution_sources (institution_id, source_name, source_url, covered_fields, accessed_date) VALUES (?, ?, ?, ?, date('now'))`
          ).bind(newId, s.source_name.trim(), formatExternalUrl(s.source_url) || null, (s.covered_fields || 'প্রোফাইল তথ্য').trim()).run();
        }
      }
      await env.DB.prepare(
        `INSERT INTO verification_logs (institution_id, admin_user_id, previous_status, new_status, verified_fields_summary, source_reference) VALUES (?, ?, 'new', ?, 'প্রাথমিক প্রোফাইল তৈরি', ?)`
      ).bind(newId, admin.id, b.verification_status || 'unverified', b.source_name || 'Admin').run();

      await saveInstitutionContacts(env, newId, b);
      await logAudit(env, admin.id, 'CREATE_INSTITUTION', 'institutions', newId, { slug, eiin }, ip);
      return jsonResponse({ ok: true, id: newId, slug });
    }
  }

  // MODULE 4: Institution Categories CRUD
  if (path === '/api/admin/categories' && req.method === 'POST') {
    const b = await req.json();
    await env.DB.prepare(`
      INSERT INTO institution_types (slug, name_en, name_bn, description_bn, display_order)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(slug) DO UPDATE SET name_en = excluded.name_en, name_bn = excluded.name_bn, description_bn = excluded.description_bn
    `).bind(slugify(b.slug || b.name_en), b.name_en, b.name_bn, b.description_bn || '', parseInt(b.display_order || '0', 10)).run();
    return jsonResponse({ ok: true });
  }

  // MODULE 5, 6, 7: Division, District, Upazila CRUD
  if (path === '/api/admin/locations' && req.method === 'POST') {
    const b = await req.json();
    if (b.level === 'division') {
      await env.DB.prepare(`INSERT OR REPLACE INTO divisions (slug, name_en, name_bn, bbs_code) VALUES (?, ?, ?, ?)`).bind(slugify(b.name_en), b.name_en, b.name_bn, b.bbs_code || '').run();
    } else if (b.level === 'district') {
      await env.DB.prepare(`INSERT OR REPLACE INTO districts (division_id, slug, name_en, name_bn, intro_bn) VALUES (?, ?, ?, ?, ?)`).bind(b.division_id, slugify(b.name_en), b.name_en, b.name_bn, b.intro_bn || '').run();
    } else if (b.level === 'upazila') {
      await env.DB.prepare(`INSERT OR REPLACE INTO upazilas (district_id, slug, name_en, name_bn, intro_bn) VALUES (?, ?, ?, ?, ?)`).bind(b.district_id, slugify(b.name_en), b.name_en, b.name_bn, b.intro_bn || '').run();
    }
    await logAudit(env, admin.id, 'UPSERT_LOCATION_' + b.level, 'locations', b.name_en, b, ip);
    return jsonResponse({ ok: true });
  }

  // MODULE 8: Results Management
  if (path === '/api/admin/results' && req.method === 'GET') {
    const rows = await env.DB.prepare(`
      SELECT r.*, i.name_bn as institution_name, i.eiin
      FROM institution_results r
      JOIN institutions i ON r.institution_id = i.id
      ORDER BY r.exam_year DESC, r.id DESC LIMIT 150
    `).all();
    return jsonResponse({ results: rows.results || [] });
  }

  if (path === '/api/admin/results' && req.method === 'DELETE') {
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return jsonResponse({ error: 'Result ID required' }, 400);
    await env.DB.prepare(`DELETE FROM institution_results WHERE id = ?`).bind(id).run();
    await logAudit(env, admin.id, 'DELETE_RESULT', 'institution_results', id, {}, ip);
    return jsonResponse({ ok: true });
  }

  if (path === '/api/admin/results' && req.method === 'POST') {
    const b = await req.json();
    const appeared = parseInt(b.appeared_students, 10) || 0;
    const passed = parseInt(b.passed_students, 10) || 0;
    const gpa5 = parseInt(b.gpa5_students, 10) || 0;
    if (appeared <= 0 || passed > appeared || gpa5 > passed) {
      return jsonResponse({ error: 'পরীক্ষার্থীর সংখ্যা সঠিক নয় (উত্তীর্ণ বা জিপিএ-৫ অংশগ্রহণকারীর চেয়ে বেশি হতে পারে না)।' }, 400);
    }
    // Institution can be entered as EIIN (e.g. 117509) or internal ID
    const instKey = String(b.institution_id || '').trim();
    let inst = await env.DB.prepare(`SELECT id FROM institutions WHERE eiin = ?`).bind(instKey).first();
    if (!inst) inst = await env.DB.prepare(`SELECT id FROM institutions WHERE id = ?`).bind(instKey).first();
    if (!inst) {
      return jsonResponse({ error: 'এই EIIN/ID দিয়ে কোনো প্রতিষ্ঠান পাওয়া যায়নি: ' + instKey }, 400);
    }
    const instId = inst.id;
    const examYear = parseInt(b.exam_year, 10);
    const group = b.academic_group || 'All';
    const failed = appeared - passed;
    const passRate = Number(((passed / appeared) * 100).toFixed(2));
    const gpa5Rate = Number(((gpa5 / appeared) * 100).toFixed(2));
    const source = b.source_name || 'Education Board Result';

    if (b.id) {
      // EDIT existing row
      await env.DB.prepare(`
        UPDATE institution_results SET
          institution_id = ?, exam_type = ?, exam_year = ?, education_board = ?, academic_group = ?,
          total_students = ?, appeared_students = ?, passed_students = ?, failed_students = ?, gpa5_students = ?,
          pass_rate = ?, gpa5_rate = ?, source_name = ?, source_url = ?, verification_status = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `).bind(
        instId, b.exam_type, examYear, b.education_board, group,
        b.total_students || appeared, appeared, passed, failed, gpa5,
        passRate, gpa5Rate, source, b.source_url || null, b.verification_status || 'verified', b.id
      ).run();
      await logAudit(env, admin.id, 'UPDATE_RESULT', 'institution_results', b.id, { exam: b.exam_type, year: examYear, passRate }, ip);
      return jsonResponse({ ok: true, pass_rate: passRate, gpa5_rate: gpa5Rate });
    }

    await env.DB.prepare(`
      INSERT INTO institution_results (
        institution_id, exam_type, exam_year, education_board, academic_group,
        total_students, appeared_students, passed_students, failed_students, gpa5_students,
        pass_rate, gpa5_rate, source_name, source_url, verification_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(institution_id, exam_type, exam_year, academic_group) DO UPDATE SET
        education_board = excluded.education_board,
        total_students = excluded.total_students,
        appeared_students = excluded.appeared_students,
        passed_students = excluded.passed_students,
        failed_students = excluded.failed_students,
        gpa5_students = excluded.gpa5_students,
        pass_rate = excluded.pass_rate,
        gpa5_rate = excluded.gpa5_rate,
        source_name = excluded.source_name,
        verification_status = excluded.verification_status,
        updated_at = datetime('now')
    `).bind(
      instId, b.exam_type, examYear, b.education_board, group,
      b.total_students || appeared, appeared, passed, failed, gpa5,
      passRate, gpa5Rate, source, b.source_url || null, b.verification_status || 'verified'
    ).run();

    await logAudit(env, admin.id, 'UPSERT_RESULT', 'institution_results', instId, { exam: b.exam_type, year: examYear, passRate }, ip);
    return jsonResponse({ ok: true, pass_rate: passRate, gpa5_rate: gpa5Rate });
  }

  // MODULE 9: Reviews & User Feedback Moderation
  if (path === '/api/admin/reviews' && req.method === 'GET') {
    const rows = await env.DB.prepare(`
      SELECT r.*, i.name_bn as institution_name, i.slug as institution_slug
      FROM institution_reviews r
      JOIN institutions i ON r.institution_id = i.id
      ORDER BY CASE WHEN r.moderation_status = 'pending' THEN 0 ELSE 1 END, r.created_at DESC LIMIT 100
    `).all();
    return jsonResponse({ reviews: rows.results || [] });
  }

  if (path === '/api/admin/reviews' && req.method === 'POST') {
    const b = await req.json();
    if (b.action === 'moderate' && b.id) {
      await env.DB.prepare(`UPDATE institution_reviews SET moderation_status = ?, updated_at = datetime('now') WHERE id = ?`).bind(b.moderation_status, b.id).run();
      await logAudit(env, admin.id, 'MODERATE_REVIEW', 'institution_reviews', b.id, { status: b.moderation_status }, ip);
      return jsonResponse({ ok: true });
    }
    const parseList = (v) => Array.isArray(v) ? v : String(v || '').split('\n').map(x => x.trim()).filter(Boolean);
    await env.DB.prepare(`
      INSERT INTO institution_reviews (
        institution_id, review_type, author_name, author_role, title_bn,
        academic_analysis_bn, facilities_analysis_bn, accessibility_notes_bn,
        strengths_json, limitations_json, overall_assessment_bn, moderation_status, published_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      b.institution_id, b.review_type || 'editorial_analysis',
      b.author_name || admin.display_name, b.author_role || 'bdresult সম্পাদনা পর্ষদ',
      b.title_bn || '', b.academic_analysis_bn || '', b.facilities_analysis_bn || '', b.accessibility_notes_bn || '',
      JSON.stringify(parseList(b.strengths)), JSON.stringify(parseList(b.limitations)),
      b.overall_assessment_bn || '', b.moderation_status || 'approved'
    ).run();

    await logAudit(env, admin.id, 'CREATE_REVIEW', 'institution_reviews', b.institution_id, { title: b.title_bn }, ip);
    return jsonResponse({ ok: true });
  }

  // MODULE 10, 11, 12: Posts, Admission Notices, Education News + Revision History + Legacy Sync
  if (path === '/api/admin/posts' && req.method === 'GET') {
    const url = new URL(req.url);
    const typeFilter = url.searchParams.get('type') || '';
    let sql = `SELECT id, slug, post_type, title_bn, status, is_legacy_markdown, institution_id, published_at, updated_at FROM posts WHERE 1=1`;
    let binds = [];
    if (typeFilter) { sql += ` AND post_type = ?`; binds.push(typeFilter); }
    sql += ` ORDER BY updated_at DESC LIMIT 150`;
    const rows = await env.DB.prepare(sql).bind(...binds).all();
    return jsonResponse({ posts: rows.results || [] });
  }

  if (path === '/api/admin/posts/revisions' && req.method === 'GET') {
    const postId = new URL(req.url).searchParams.get('post_id');
    const rows = await env.DB.prepare(`SELECT * FROM post_revisions WHERE post_id = ? ORDER BY created_at DESC`).bind(postId).all();
    return jsonResponse({ revisions: rows.results || [] });
  }

  if (path === '/api/admin/posts/sync-legacy' && req.method === 'POST') {
    const assetRes = await env.ASSETS.fetch(new Request(SITE_URL + '/api-static-posts.json'));
    if (!assetRes.ok) return jsonResponse({ error: 'api-static-posts.json পাওয়া যায়নি। আগে npm run build রান করুন।' }, 404);
    const staticPosts = await assetRes.json();
    let count = 0;
    for (const sp of staticPosts) {
      await env.DB.prepare(`
        INSERT INTO posts (slug, post_type, title_bn, excerpt_bn, content_markdown, content_html, featured_image, status, is_legacy_markdown, seo_title, meta_description, published_at)
        VALUES (?, 'education_guide', ?, ?, ?, ?, ?, 'published', 1, ?, ?, ?)
        ON CONFLICT(slug) DO UPDATE SET
          title_bn = excluded.title_bn,
          content_html = excluded.content_html,
          is_legacy_markdown = 1
      `).bind(sp.slug, sp.title, sp.description || '', sp.text || '', sp.html || '', sp.image || '', sp.title, sp.description || '', sp.date).run();
      count++;
    }
    await logAudit(env, admin.id, 'SYNC_LEGACY_POSTS', 'posts', count, { count }, ip);
    return jsonResponse({ ok: true, synced: count });
  }

  if (path === '/api/admin/posts' && req.method === 'POST') {
    const b = await req.json();
    const slug = slugify(b.slug || b.title_en || b.title_bn);
    const res = await env.DB.prepare(`
      INSERT INTO posts (slug, post_type, title_bn, excerpt_bn, content_markdown, content_html, featured_image, featured_image_alt, category_id, institution_id, status, seo_title, meta_description, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(slug) DO UPDATE SET
        post_type = excluded.post_type,
        title_bn = excluded.title_bn,
        excerpt_bn = excluded.excerpt_bn,
        content_markdown = excluded.content_markdown,
        content_html = excluded.content_html,
        featured_image = excluded.featured_image,
        featured_image_alt = excluded.featured_image_alt,
        category_id = excluded.category_id,
        institution_id = excluded.institution_id,
        status = excluded.status,
        seo_title = excluded.seo_title,
        meta_description = excluded.meta_description,
        updated_at = datetime('now')
    `).bind(
      slug, b.post_type || 'education_guide', b.title_bn, b.excerpt_bn || '',
      b.content_markdown || '', renderPostBody(b.content_html || b.content_markdown || ''),
      b.featured_image || null, b.featured_image_alt || b.title_bn,
      b.category_id ? parseInt(b.category_id, 10) : null,
      b.institution_id ? parseInt(b.institution_id, 10) : null,
      b.status || 'draft', b.seo_title || b.title_bn, b.meta_description || b.excerpt_bn || ''
    ).run();

    const postRow = await env.DB.prepare(`SELECT id FROM posts WHERE slug = ?`).bind(slug).first();
    if (postRow) {
      await env.DB.prepare(
        `INSERT INTO post_revisions (post_id, title_bn, content_markdown, edited_by_admin_id, revision_note) VALUES (?, ?, ?, ?, ?)`
      ).bind(postRow.id, b.title_bn, b.content_markdown || '', admin.id, b.revision_note || 'Content update').run();
    }
    await logAudit(env, admin.id, 'UPSERT_POST', 'posts', slug, { type: b.post_type, status: b.status }, ip);
    return jsonResponse({ ok: true, slug });
  }

  // MODULE 13: CSV Bulk Import + Rollback
  if (path === '/api/admin/import' && req.method === 'POST') {
    const b = await req.json();
    const records = Array.isArray(b.records) ? b.records : [];
    const mode = b.mode || 'preview';
    const fileName = b.file_name || 'bulk-upload.csv';

    let valid = [];
    let duplicates = [];
    let errors = [];

    for (let idx = 0; idx < records.length; idx++) {
      const r = records[idx];
      if (!r.name_en || !r.name_bn) {
        errors.push({ row: idx + 1, eiin: r.eiin || '', reason: 'বাংলা অথবা ইংরেজি নাম অনুপস্থিত' });
        continue;
      }
      const eiin = r.eiin ? String(r.eiin).trim() : null;
      const norm = normalizeName(r.name_en);
      const existing = await env.DB.prepare(
        `SELECT id, name_bn, eiin FROM institutions WHERE (eiin IS NOT NULL AND eiin = ?) OR normalized_name = ?`
      ).bind(eiin || '__NONE__', norm).first();

      if (existing) {
        duplicates.push({ row: idx + 1, eiin: r.eiin || '', existing_id: existing.id, existing_name: existing.name_bn, reason: 'ডুপ্লিকেট EIIN বা নাম' });
        continue;
      }
      valid.push({ ...r, eiin, normalized_name: norm });
    }

    let jobId = null;
    if (mode === 'commit' && valid.length > 0) {
      const jobRes = await env.DB.prepare(`
        INSERT INTO import_jobs (file_name, total_rows, valid_rows, duplicate_rows, error_rows, status, error_report_json, imported_by_admin_id)
        VALUES (?, ?, ?, ?, ?, 'completed', ?, ?)
      `).bind(fileName, records.length, valid.length, duplicates.length, errors.length, JSON.stringify([...duplicates, ...errors]), admin.id).run();

      jobId = jobRes.meta?.last_row_id;

      for (const v of valid) {
        const slug = slugify(v.name_en + (v.eiin ? '-' + v.eiin : ''));
        const code = 'BDR-' + Math.floor(100000 + Math.random() * 900000);
        await env.DB.prepare(`
          INSERT OR IGNORE INTO institutions (
            internal_code, eiin, slug, name_en, name_bn, normalized_name,
            institution_type_id, division_id, district_id, upazila_id,
            address_bn, established_year, management_type, gender_type, education_board,
            verification_status, is_published, completeness_score, import_job_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_review', 0, 45, ?)
        `).bind(
          code, v.eiin, slug, v.name_en, v.name_bn, v.normalized_name,
          parseInt(v.institution_type_id, 10) || 1,
          parseInt(v.division_id, 10) || 1,
          parseInt(v.district_id, 10) || 1,
          parseInt(v.upazila_id, 10) || 1,
          v.address_bn || null,
          v.established_year ? parseInt(v.established_year, 10) : null,
          v.management_type || 'unknown',
          v.education_board || null,
          jobId
        ).run();
      }
      await logAudit(env, admin.id, 'BULK_IMPORT_COMMIT', 'import_jobs', jobId, { imported: valid.length }, ip);
    }

    return jsonResponse({
      mode,
      job_id: jobId,
      total: records.length,
      valid_count: valid.length,
      duplicate_count: duplicates.length,
      error_count: errors.length,
      duplicates,
      errors
    });
  }

  if (path === '/api/admin/import/rollback' && req.method === 'POST') {
    const b = await req.json();
    const jobId = parseInt(b.job_id, 10);
    if (!jobId) return jsonResponse({ error: 'Invalid Job ID' }, 400);
    await env.DB.prepare(`DELETE FROM institutions WHERE import_job_id = ? AND verification_status != 'verified'`).bind(jobId).run();
    await env.DB.prepare(`UPDATE import_jobs SET status = 'rolled_back' WHERE id = ?`).bind(jobId).run();
    await logAudit(env, admin.id, 'ROLLBACK_IMPORT_JOB', 'import_jobs', jobId, { jobId }, ip);
    return jsonResponse({ ok: true });
  }

  // MODULE 15: Correction Requests
  if (path === '/api/admin/corrections' && req.method === 'GET') {
    const rows = await env.DB.prepare(`
      SELECT c.*, i.name_bn as institution_name, i.slug as institution_slug
      FROM correction_requests c
      JOIN institutions i ON c.institution_id = i.id
      ORDER BY CASE WHEN c.status = 'pending' THEN 0 ELSE 1 END, c.created_at DESC LIMIT 100
    `).all();
    return jsonResponse({ corrections: rows.results || [] });
  }

  if (path === '/api/admin/corrections' && req.method === 'POST') {
    const b = await req.json();
    await env.DB.prepare(`
      UPDATE correction_requests SET status = ?, admin_notes = ?, reviewed_by_admin_id = ?, reviewed_at = datetime('now') WHERE id = ?
    `).bind(b.status, b.admin_notes || '', admin.id, b.id).run();
    await logAudit(env, admin.id, 'REVIEW_CORRECTION', 'correction_requests', b.id, { status: b.status }, ip);
    return jsonResponse({ ok: true });
  }

  // MODULE 16: Media Library
  if (path === '/api/admin/media' && req.method === 'GET') {
    const rows = await env.DB.prepare(`SELECT * FROM media ORDER BY created_at DESC LIMIT 100`).all();
    return jsonResponse({ media: rows.results || [] });
  }

  if (path === '/api/admin/media' && req.method === 'POST') {
    const b = await req.json();
    await env.DB.prepare(`
      INSERT OR REPLACE INTO media (file_name, file_path, mime_type, alt_text_bn, alt_text_en, uploaded_by_admin_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(b.file_name, b.file_path, b.mime_type || 'image/webp', b.alt_text_bn, b.alt_text_en || '', admin.id).run();
    return jsonResponse({ ok: true });
  }

  // MODULE 17: SEO Audit Report
  if (path === '/api/admin/seo-audit' && req.method === 'GET') {
    const [thinInst, missingSeo] = await Promise.all([
      env.DB.prepare(`SELECT id, slug, name_bn, completeness_score, verification_status, is_published FROM institutions WHERE completeness_score < 50 OR verification_status != 'verified'`).all(),
      env.DB.prepare(`SELECT id, slug, name_bn FROM institutions WHERE is_published = 1 AND (overview_bn IS NULL OR LENGTH(overview_bn) < 40)`).all()
    ]);
    return jsonResponse({
      noindex_guarded: thinInst.results || [],
      missing_overview: missingSeo.results || []
    });
  }

  // MODULE 19: Admin Users
  if (path === '/api/admin/users' && req.method === 'GET') {
    const rows = await env.DB.prepare(`SELECT * FROM admin_users ORDER BY id ASC`).all();
    return jsonResponse({ users: rows.results || [] });
  }

  if (path === '/api/admin/users' && req.method === 'POST') {
    if (admin.role !== 'super_admin') return jsonResponse({ error: 'শুধুমাত্র সুপার অ্যাডমিন ইউজার রোল পরিবর্তন করতে পারেন।' }, 403);
    const b = await req.json();
    await env.DB.prepare(`
      INSERT INTO admin_users (github_username, display_name, role, is_active)
      VALUES (?, ?, ?, 1)
      ON CONFLICT(github_username) DO UPDATE SET role = excluded.role, display_name = excluded.display_name, is_active = excluded.is_active
    `).bind(b.github_username.trim(), b.display_name.trim(), b.role || 'editor').run();
    return jsonResponse({ ok: true });
  }

  // MODULE 21: System Settings
  if (path === '/api/admin/settings' && req.method === 'POST') {
    const b = await req.json();
    for (const [k, v] of Object.entries(b)) {
      await env.DB.prepare(`INSERT OR REPLACE INTO system_settings (setting_key, setting_value, updated_at) VALUES (?, ?, datetime('now'))`).bind(k, String(v)).run();
    }
    await logAudit(env, admin.id, 'UPDATE_SETTINGS', 'system_settings', 'global', b, ip);
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ error: 'Admin endpoint not found' }, 404);
}

// ============================================================================
// MAIN WORKER FETCH ROUTER
// ============================================================================
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname;
    if (!path.startsWith('/api/')) await ensureSiteConfig(env);

    try {
      // 1. Dynamic Institution XML Sitemap
      if (path === '/sitemap-institutions.xml') {
        return await handleInstitutionSitemap(env, url);
      }

      // 2. Public Correction Submission API (with Rate Limit)
      if (path === '/api/corrections' && req.method === 'POST') {
        const ipHash = await hashIp(req.headers.get('CF-Connecting-IP'));
        if (await isRateLimited(env, ipHash, 'correction_requests', 10)) {
          return jsonResponse({ error: 'আপনি ঘণ্টায় সর্বোচ্চ ১০টি অনুরোধ পাঠাতে পারেন। কিছুক্ষণ পর চেষ্টা করুন।' }, 429);
        }
        const b = await req.json();
        if (!b.institution_id || !b.requester_name || !b.field_name || !b.proposed_value || !b.evidence_description) {
          return jsonResponse({ error: 'সকল তারকা (*) চিহ্নিত ঘর পূরণ করুন।' }, 400);
        }
        await env.DB.prepare(`
          INSERT INTO correction_requests (
            institution_id, requester_name, requester_email, requester_relation,
            field_name, proposed_value, evidence_description, ip_hash
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          b.institution_id, b.requester_name.slice(0, 100), (b.requester_email || '').slice(0, 100),
          (b.requester_relation || 'Public').slice(0, 80), b.field_name.slice(0, 100),
          b.proposed_value.slice(0, 1000), b.evidence_description.slice(0, 1000), ipHash
        ).run();
        return jsonResponse({ ok: true });
      }

      // 3. Public User Feedback Submission API (with Moderation & Rate Limit)
      if (path === '/api/reviews' && req.method === 'POST') {
        const ipHash = await hashIp(req.headers.get('CF-Connecting-IP'));
        if (await isRateLimited(env, ipHash, 'institution_reviews', 5)) {
          return jsonResponse({ error: 'অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।' }, 429);
        }
        const b = await req.json();
        if (!b.institution_id || !b.author_name || !b.overall_assessment_bn) {
          return jsonResponse({ error: 'নাম এবং মতামত আবশ্যক।' }, 400);
        }
        await env.DB.prepare(`
          INSERT INTO institution_reviews (
            institution_id, review_type, author_name, author_role, overall_assessment_bn, moderation_status, ip_hash
          ) VALUES (?, 'user_feedback', ?, ?, ?, 'pending', ?)
        `).bind(
          b.institution_id, b.author_name.slice(0, 80), (b.author_role || 'শিক্ষার্থী/অভিভাবক').slice(0, 60),
          b.overall_assessment_bn.slice(0, 1500), ipHash
        ).run();
        return jsonResponse({ ok: true });
      }

      // 4. Public Search JSON API (/api/institutions)
      if (path === '/api/institutions' && req.method === 'GET') {
        const q = (url.searchParams.get('q') || '').trim();
        const rows = await env.DB.prepare(`
          SELECT slug, eiin, name_bn, name_en, verification_status
          FROM institutions
          WHERE is_published = 1 AND (eiin = ? OR name_bn LIKE ? OR name_en LIKE ?)
          LIMIT 20
        `).bind(q, `%${q}%`, `%${q}%`).all();
        return jsonResponse({ results: rows.results || [] });
      }

      // 5. Admin APIs (/api/admin/*)
      if (path.startsWith('/api/admin/')) {
        return await handleAdminApi(req, env, path);
      }

      // 6. Results Comparison & Statistics Route (/results/compare/)
      if (path === '/results/compare' || path === '/results/compare/') {
        return await handleResultsComparisonPage(req, env);
      }

      // 7. Public Institution Directory Routes
      if (path === '/institutions' || path === '/institutions/') {
        return await handlePublicDirectory(req, env, {});
      }
      const catMatch = path.match(/^\/institutions\/([a-z0-9-]+)\/?$/);
      if (catMatch) {
        return await handlePublicDirectory(req, env, { typeSlug: catMatch[1] });
      }
      const distMatch = path.match(/^\/districts\/([a-z0-9-]+)\/?$/);
      if (distMatch) {
        return await handlePublicDirectory(req, env, { districtSlug: distMatch[1] });
      }
      const upzMatch = path.match(/^\/upazilas\/([a-z0-9-]+)\/?$/);
      if (upzMatch) {
        return await handlePublicDirectory(req, env, { upazilaSlug: upzMatch[1] });
      }

      // 8. Single Institution Profile Route (/institution/{slug}/)
      const profMatch = path.match(/^\/institution\/([a-z0-9-]+)\/?$/);
      if (profMatch) {
        const res = await handleInstitutionProfile(req, env, profMatch[1]);
        if (res) return res;
      }

      // 9. Static Assets First (Preserves all existing posts, pages, /emis/, images, /admin/)
      if (env.ASSETS) {
        const assetRes = await env.ASSETS.fetch(req);
        if (assetRes.status !== 404) return assetRes;
      }

      // 10. Dynamic Database Post Fallback (If a new post was created in D1 via Admin Dashboard)
      const slugMatch = path.match(/^\/(?:posts\/)?([a-z0-9-]+)\/?$/);
      if (slugMatch) {
        const dbPostRes = await handleDynamicDatabasePost(env, slugMatch[1]);
        if (dbPostRes) return dbPostRes;
      }

      // Return 404 page from static build
      if (env.ASSETS) {
        return await env.ASSETS.fetch(new Request(SITE_URL + '/404.html'));
      }
      return new Response('404 Not Found', { status: 404 });
    } catch (err) {
      console.error('Worker Error:', err);
      if (new URL(req.url).pathname.startsWith('/api/')) {
        return jsonResponse({ error: 'সার্ভার ত্রুটি: ' + err.message }, 500);
      }
      return new Response('Internal Server Error: ' + err.message, { status: 500 });
    }
  }
};