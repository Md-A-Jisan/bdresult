import { esc, shell } from './console.mjs';
import { MGMT } from './validate.mjs';
import { PUBLISH_MIN, STATUSES } from './institutions.mjs';

const pill = (t) => `<span class="pill ${esc(t)}">${esc(t)}</span>`;
const opt = (v, label, sel) => `<option value="${esc(v)}"${String(sel ?? '') === String(v) ? ' selected' : ''}>${esc(label)}</option>`;
const errOf = (e, k) => (e && e[k] ? `<div class="err">${esc(e[k])}</div>` : '');
export const canEdit = (u) => ['owner', 'admin', 'editor'].includes(u.role);
export const canVerify = (u) => ['owner', 'admin', 'reviewer'].includes(u.role);
export const canPublish = (u) => ['owner', 'admin'].includes(u.role);
export const canSource = (u) => ['owner', 'admin', 'editor', 'reviewer'].includes(u.role);

export function listPage(user, data, lk, f) {
  const qs = (o) => new URLSearchParams(Object.entries({ ...f, ...o }).filter(([, v]) => v !== '' && v != null)).toString();
  const rows = data.rows.map((r) => `<tr><td><a href="/console/institutions/${r.id}">${esc(r.name_en)}</a>${r.name_bn ? `<br><span class="muted">${esc(r.name_bn)}</span>` : ''}</td><td>${esc(r.eiin || '—')}</td><td>${esc(r.type_name)}</td><td>${esc(r.district_name || '—')}</td><td>${pill(r.verification_status)}</td><td>${pill(r.publish_state)}</td><td>${r.completeness}%</td></tr>`).join('') || '<tr><td colspan="7">No institutions match.</td></tr>';
  return shell(user, 'Institutions', 'institutions', `<h1>Institutions <span class="muted">(${data.total})</span></h1>
<form class="bar" method="get" action="/console/institutions"><input name="q" value="${esc(f.q)}" placeholder="Name, Bengali name or EIIN">
<select name="type"><option value="">All types</option>${lk.types.map((t) => opt(t.id, t.name_en, f.type)).join('')}</select>
<select name="district"><option value="">All districts</option>${lk.districts.map((d) => opt(d.id, d.name_en, f.district)).join('')}</select>
<select name="status"><option value="">Any verification</option>${STATUSES.map((x) => opt(x, x, f.status)).join('')}</select>
<select name="publish"><option value="">Any publish state</option>${['draft', 'published', 'archived'].map((x) => opt(x, x, f.publish)).join('')}</select>
<button class="btn" type="submit">Filter</button>${canEdit(user) ? ' <a class="btn" href="/console/institutions/new">+ Add institution</a>' : ''}</form>
<table><tr><th>Name</th><th>EIIN</th><th>Type</th><th>District</th><th>Verification</th><th>Publish</th><th>Complete</th></tr>${rows}</table>
<div class="pager">${data.page > 1 ? `<a href="?${esc(qs({ page: data.page - 1 }))}">← Previous</a>` : ''}<span class="muted">Page ${data.page} of ${data.pages}</span>${data.page < data.pages ? `<a href="?${esc(qs({ page: data.page + 1 }))}">Next →</a>` : ''}</div>`);
}

export function formPage(user, lk, v, errors, { action, title, dupes = [] }) {
  const field = (k, label, type = 'text', extra = '') => `<div><label for="${k}">${label}</label><input id="${k}" name="${k}" type="${type}" value="${esc(v[k] ?? '')}" ${extra}>${errOf(errors, k)}</div>`;
  const warn = errors._dup ? '' : dupes.some((d) => d.reason !== 'same_eiin')
    ? `<div class="alert"><b>Possible duplicate.</b> ${dupes.map((d) => `<a href="/console/institutions/${d.id}">${esc(d.name_en)}</a> (${esc(d.reason.replace(/_/g, ' '))})`).join('; ')}<br><label style="font-weight:400"><input type="checkbox" name="confirm_duplicate" value="1"> I checked: this is a different institution, save anyway.</label></div>` : '';
  const hardDup = dupes.filter((d) => d.reason === 'same_eiin').map((d) => `<div class="alert">EIIN already belongs to <a href="/console/institutions/${d.id}">${esc(d.name_en)}</a>.</div>`).join('');
  return shell(user, title, 'institutions', `<h1>${esc(title)}</h1>${Object.keys(errors).filter((k) => k !== '_dup').length ? '<div class="alert">Please fix the highlighted fields.</div>' : ''}${hardDup}${warn}
<form method="post" action="${esc(action)}" class="panel">
<div class="f2">${field('name_en', 'English name *')}${field('name_bn', 'Bengali name')}${field('eiin', 'EIIN (leave empty if none)', 'text', 'inputmode="numeric"')}
<div><label for="type_id">Type *</label><select id="type_id" name="type_id"><option value="">Choose…</option>${lk.types.map((t) => opt(t.id, t.name_en, v.type_id)).join('')}</select>${errOf(errors, 'type_id')}</div>
<div><label for="district_id">District</label><select id="district_id" name="district_id"><option value="">Not set</option>${lk.districts.map((d) => opt(d.id, `${d.name_en} (${d.division})`, v.district_id)).join('')}</select>${errOf(errors, 'district_id')}</div>
<div><label for="management_type">Management</label><select id="management_type" name="management_type"><option value="">Not set</option>${MGMT.map((m) => opt(m, m.replace('_', '-'), v.management_type)).join('')}</select>${errOf(errors, 'management_type')}</div>
${field('established_year', 'Established year', 'text', 'inputmode="numeric"')}${field('postal_code', 'Postal code', 'text', 'inputmode="numeric"')}
${field('latitude', 'Latitude')}${field('longitude', 'Longitude')}</div>
<label style="font-weight:400"><input type="checkbox" name="coords_verified" value="1"${v.coords_verified ? ' checked' : ''}> Coordinates are verified</label>
${field('website', 'Official website', 'url')}${field('address', 'Address')}
<label for="summary">Summary (facts only, no unverified claims)</label><textarea id="summary" name="summary">${esc(v.summary ?? '')}</textarea>${errOf(errors, 'summary')}
<p><button class="btn" type="submit">Save</button> <a href="/console/institutions">Cancel</a></p></form>`);
}

export function detailPage(user, i, lk, sources, log, { msg = '', error = '', srcErrors = {}, srcValues = {} } = {}) {
  const dl = (k, val) => `<tr><th style="width:170px">${k}</th><td>${esc(val ?? '—')}</td></tr>`;
  const srcRows = sources.map((s) => `<tr><td>${esc(s.source_name)}${s.source_url ? `<br><a href="${esc(s.source_url)}" rel="noopener nofollow">${esc(s.source_url)}</a>` : ''}</td><td>${esc(s.field_name || 'whole profile')}</td><td>${esc(s.accessed_on)}</td></tr>`).join('') || '<tr><td colspan="3">No sources yet. A source is required before verification.</td></tr>';
  const logRows = log.map((l) => `<tr><td>${esc(l.created_at)}</td><td>${esc(l.admin || 'system')}</td><td>${esc(l.from_status || '—')} → ${esc(l.to_status)}</td><td>${esc(l.note || '')}</td></tr>`).join('') || '<tr><td colspan="4">No history.</td></tr>';
  const post = (path, body) => `<form class="inline" method="post" action="/console/institutions/${i.id}/${path}">${body}</form>`;
  return shell(user, i.name_en, 'institutions', `<p><a href="/console/institutions">← All institutions</a></p><h1>${esc(i.name_en)}</h1>
${msg ? `<div class="okmsg">${esc(msg)}</div>` : ''}${error ? `<div class="alert">${esc(error)}</div>` : ''}
<div class="panel"><p>${pill(i.verification_status)} ${pill(i.publish_state)} <span class="muted">Complete ${i.completeness}% · publish needs verified + ${PUBLISH_MIN}%</span></p>
<table>${dl('Bengali name', i.name_bn)}${dl('EIIN', i.eiin)}${dl('Type', i.type_name)}${dl('Location', [i.district_name, i.division_name].filter(Boolean).join(', '))}${dl('Address', i.address)}${dl('Management', i.management_type)}${dl('Established', i.established_year)}${dl('Website', i.website)}${dl('URL slug', i.slug)}${dl('Last verified', i.last_verified_at)}</table>
<p>${canEdit(user) ? `<a class="btn" href="/console/institutions/${i.id}/edit">Edit facts</a> ` : ''}${i.publish_state !== 'published' && canPublish(user) ? post('publish', '<input type="hidden" name="action" value="publish"><button class="btn" type="submit">Publish</button>') : ''}${i.publish_state === 'published' && canPublish(user) ? post('publish', '<input type="hidden" name="action" value="unpublish"><button class="btn warn" type="submit">Unpublish</button>') : ''}${i.publish_state !== 'archived' && canPublish(user) ? post('publish', '<input type="hidden" name="action" value="archive"><button class="btn ghost" style="color:#1c2330" type="submit">Archive</button>') : ''}</p></div>
${canVerify(user) ? `<div class="panel"><h2 style="margin-top:0">Verification</h2>${post('verify', `<select name="status">${STATUSES.map((x) => opt(x, x, i.verification_status)).join('')}</select> <input name="note" placeholder="Note (optional)" size="40"> <button class="btn" type="submit">Update status</button>`)}</div>` : ''}
<h2>Sources</h2><table><tr><th>Source</th><th>Supports</th><th>Accessed</th></tr>${srcRows}</table>
${canSource(user) ? `<form class="panel" method="post" action="/console/institutions/${i.id}/sources" style="margin-top:12px"><div class="f2"><div><label>Source name *</label><input name="source_name" value="${esc(srcValues.source_name)}">${errOf(srcErrors, 'source_name')}</div><div><label>Source link</label><input name="source_url" type="url" value="${esc(srcValues.source_url)}">${errOf(srcErrors, 'source_url')}</div><div><label>Date accessed * (YYYY-MM-DD)</label><input name="accessed_on" value="${esc(srcValues.accessed_on)}">${errOf(srcErrors, 'accessed_on')}</div><div><label>Supports field (optional)</label><input name="field_name" value="${esc(srcValues.field_name)}"></div></div><p><button class="btn" type="submit">Add source</button></p></form>` : ''}
<h2>Verification history</h2><table><tr><th>Time (UTC)</th><th>By</th><th>Change</th><th>Note</th></tr>${logRows}</table>`);
}

export const notAllowedPage = (user) => shell(user, 'Not allowed', '', '<h1>Not allowed</h1><p>Your role does not permit this action.</p><p><a href="/console/">Back to overview</a></p>');
export const notFoundPage = (user) => shell(user, 'Not found', '', '<h1>Not found</h1><p><a href="/console/institutions">Back to institutions</a></p>');
