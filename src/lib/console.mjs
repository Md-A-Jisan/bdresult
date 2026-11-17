// Server-rendered admin console pages. Visual system is separate from the public site (see brief section 4).
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const CONSOLE_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store',
  'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'same-origin',
  'x-robots-tag': 'noindex, nofollow',
};

const CSS = `*{box-sizing:border-box}body{margin:0;font:15px/1.5 system-ui,"Segoe UI","Noto Sans Bengali","Nirmala UI",sans-serif;background:#f4f5f7;color:#1c2330}
header{background:#1c2330;color:#fff;padding:12px 24px;display:flex;justify-content:space-between;align-items:center}header b{font-size:16px}
main{max-width:1000px;margin:24px auto;padding:0 16px}h1{font-size:20px;margin:0 0 16px}h2{font-size:15px;margin:28px 0 10px;color:#4a5568;text-transform:uppercase;letter-spacing:.04em}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}.card{background:#fff;border:1px solid #dde1e7;border-radius:8px;padding:14px 16px}
.card span{display:block;color:#5b6573;font-size:13px}.card strong{font-size:26px}table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #dde1e7;border-radius:8px;overflow:hidden}
td,th{padding:9px 12px;text-align:left;border-bottom:1px solid #eceff3;font-size:14px}th{background:#f8f9fb;color:#5b6573;font-weight:600}
.btn{display:inline-block;background:#0b6b4f;color:#fff;border:0;border-radius:6px;padding:9px 16px;font:inherit;text-decoration:none;cursor:pointer}.btn.ghost{background:transparent;border:1px solid #6b7686;padding:5px 12px}
.box{max-width:380px;margin:12vh auto;background:#fff;border:1px solid #dde1e7;border-radius:10px;padding:28px;text-align:center}.muted{color:#5b6573;font-size:13px}form{margin:0}nav{display:flex;gap:4px;background:#263042;padding:0 24px}nav a{color:#c5ccd6;text-decoration:none;padding:10px 14px;font-size:14px}nav a.on{color:#fff;border-bottom:2px solid #3ecf8e}.bar{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 14px;align-items:center}input,select,textarea{font:inherit;padding:7px 9px;border:1px solid #c5ccd6;border-radius:6px;background:#fff;max-width:100%}textarea{width:100%;min-height:90px}label{display:block;font-weight:600;font-size:13px;margin:12px 0 4px}.f2{display:grid;grid-template-columns:1fr 1fr;gap:0 16px}@media(max-width:640px){.f2{grid-template-columns:1fr}}.panel{background:#fff;border:1px solid #dde1e7;border-radius:8px;padding:16px 18px;margin-bottom:16px}.err{color:#b42318;font-size:13px;margin:3px 0 0}.alert{background:#fef3f2;border:1px solid #fda29b;border-radius:6px;padding:10px 12px;margin-bottom:12px}.okmsg{background:#ecfdf3;border:1px solid #75e0a7;border-radius:6px;padding:10px 12px;margin-bottom:12px}.pill{display:inline-block;padding:1px 9px;border-radius:99px;font-size:12px;font-weight:600;background:#eceff3;color:#4a5568}.pill.verified,.pill.published{background:#d1fadf;color:#05603a}.pill.pending{background:#fef0c7;color:#93370d}.pill.disputed{background:#fee4e2;color:#912018}.pager{display:flex;gap:10px;align-items:center;margin-top:12px}td a{color:#0b6b4f;font-weight:600;text-decoration:none}.btn.warn{background:#b54708}.inline{display:inline-block;margin-right:6px}`;

const page = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${esc(title)} · bdresult console</title><style>${CSS}</style></head><body>${body}</body></html>`;

export const loginPage = (notice = '') => page('Sign in', `<div class="box"><h1>bdresult console</h1><p class="muted">Administrators only.</p>${notice ? `<p>${esc(notice)}</p>` : ''}<a class="btn" href="/api/auth/login">Sign in with GitHub</a></div>`);

const navLink = (href, label, on) => `<a href="${href}"${on ? ' class="on"' : ''}>${label}</a>`;
export const shell = (user, title, active, content) => page(title, `<header><b>bdresult console</b><form method="post" action="/api/auth/logout"><span class="muted" style="color:#c5ccd6">${esc(user.display_name || user.github_login)} · ${esc(user.role)}</span> &nbsp;<button class="btn ghost" type="submit">Sign out</button></form></header><nav>${navLink('/console/', 'Overview', active === 'overview')}${navLink('/console/institutions', 'Institutions', active === 'institutions')}</nav><main>${content}</main>`);

export function dashboardPage(user, s) {
  const card = (label, n) => `<div class="card"><span>${esc(label)}</span><strong>${Number(n) || 0}</strong></div>`;
  const types = s.byType.map((t) => `<tr><td>${esc(t.name_en)}</td><td>${t.n}</td></tr>`).join('') || '<tr><td colspan="2">No data</td></tr>';
  const acts = s.recent.map((a) => `<tr><td>${esc(a.created_at)}</td><td>${esc(a.admin || 'system')}</td><td>${esc(a.action)} ${esc(a.entity_type)}</td></tr>`).join('') || '<tr><td colspan="3">No activity yet</td></tr>';
  return shell(user, 'Overview', 'overview', `<h1>Overview</h1><div class="grid">${card('Total institutions', s.total)}${card('Verified', s.verified)}${card('Pending verification', s.pending)}${card('Open correction requests', s.corrections)}</div>
<h2>Institutions by type</h2><table><tr><th>Type</th><th>Count</th></tr>${types}</table>
<h2>Recent activity</h2><table><tr><th>Time (UTC)</th><th>Admin</th><th>Action</th></tr>${acts}</table>
<p class="muted">Articles and drafts are managed in the existing content editor at /admin/.</p>`);
}

export async function loadStats(db) {
  const t = await db.prepare("SELECT COUNT(*) AS total, COALESCE(SUM(verification_status = 'verified'), 0) AS verified, COALESCE(SUM(verification_status = 'pending'), 0) AS pending FROM institutions").first();
  const c = await db.prepare("SELECT COUNT(*) AS n FROM correction_requests WHERE status IN ('open','needs_info')").first();
  const byType = (await db.prepare('SELECT t.name_en AS name_en, COUNT(i.id) AS n FROM institution_types t LEFT JOIN institutions i ON i.type_id = t.id GROUP BY t.id ORDER BY t.sort_order').all()).results;
  const recent = (await db.prepare('SELECT a.created_at AS created_at, u.github_login AS admin, a.action AS action, a.entity_type AS entity_type FROM audit_logs a LEFT JOIN admin_users u ON u.id = a.admin_id ORDER BY a.id DESC LIMIT 10').all()).results;
  return { total: t.total, verified: t.verified, pending: t.pending, corrections: c.n, byType, recent };
}
