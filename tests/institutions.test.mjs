import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { signToken } from '../src/lib/session.mjs';
import worker from '../src/worker.mjs';

function makeDb() {
  const raw = new DatabaseSync(':memory:'); raw.exec('PRAGMA foreign_keys=ON');
  for (const f of readdirSync('migrations').filter((x) => x.endsWith('.sql')).sort()) raw.exec(readFileSync(`migrations/${f}`, 'utf8'));
  const wrap = (st, a) => ({ first: async () => st.get(...a) ?? null, all: async () => ({ results: st.all(...a) }), run: async () => { const r = st.run(...a); return { meta: { changes: r.changes } }; } });
  return { raw, prepare: (sql) => { const st = raw.prepare(sql); return { ...wrap(st, []), bind: (...a) => wrap(st, a) }; } };
}
const SECRET = 'x'.repeat(40), ORIGIN = 'http://127.0.0.1:8787';
const mk = () => ({ DB: makeDb(), GITHUB_CLIENT_ID: 'c', GITHUB_CLIENT_SECRET: 's', SESSION_SECRET: SECRET, ASSETS: { fetch: () => new Response('a', { status: 404 }) } });
async function asRole(env, role) {
  const login = `u-${role}`;
  env.DB.raw.prepare('INSERT OR IGNORE INTO admin_users (github_login, github_id, role) VALUES (?, ?, ?)').run(login, Math.floor(Math.random() * 1e9), role);
  const { id } = env.DB.raw.prepare('SELECT id FROM admin_users WHERE github_login = ?').get(login);
  return `bdr_session=${await signToken({ uid: id, exp: Date.now() + 60000 }, SECRET)}`;
}
const get = (env, cookie, path) => worker.fetch(new Request(ORIGIN + path, { headers: { cookie } }), env);
const post = (env, cookie, path, data, origin = ORIGIN) => worker.fetch(new Request(ORIGIN + path, { method: 'POST', headers: { cookie, origin, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(data) }), env);
const good = { name_en: 'Government Test College', name_bn: 'সরকারি টেস্ট কলেজ', eiin: '123456', type_id: '2', district_id: '1', management_type: 'government' };
const rows = (env, sql, ...a) => env.DB.raw.prepare(sql).all(...a);
const idOf = (res) => Number(res.headers.get('location').match(/institutions\/(\d+)/)[1]);

test('districts seed: 64 districts across 8 divisions', () => {
  const env = mk();
  assert.deepEqual(Object.values(rows(env, 'SELECT COUNT(*) c, COUNT(DISTINCT division_id) d FROM districts')[0]), [64, 8]);
});

test('create: derives division from district, makes slug, alias, audit, completeness', async () => {
  const env = mk(), c = await asRole(env, 'editor');
  const r = await post(env, c, '/console/institutions', { ...good, district_id: '25' });   // 25 = Narayanganj? checked below
  assert.equal(r.status, 303);
  const i = rows(env, 'SELECT * FROM institutions')[0];
  const d = rows(env, 'SELECT division_id, slug FROM districts WHERE id = ?', i.district_id)[0];
  assert.equal(i.division_id, d.division_id);
  assert.equal(i.slug, `government-test-college-${d.slug}`);
  assert.equal(i.name_norm, 'government test college');
  assert.equal(i.verification_status, 'unverified'); assert.equal(i.publish_state, 'draft');
  assert.ok(i.completeness > 0 && i.completeness < 70);
  assert.equal(rows(env, 'SELECT * FROM institution_aliases WHERE institution_id = ?', i.id)[0].alias, 'সরকারি টেস্ট কলেজ');
  assert.equal(rows(env, "SELECT * FROM audit_logs WHERE action = 'create'").length, 1);
});

test('create: validation errors insert nothing', async () => {
  const env = mk(), c = await asRole(env, 'editor');
  const r = await post(env, c, '/console/institutions', { name_en: 'ab', eiin: '12A', type_id: '99', latitude: '48', longitude: '90', website: 'javascript:alert(1)', established_year: '3000' });
  const body = await r.text();
  assert.equal(r.status, 400);
  for (const m of ['English name is required', 'EIIN must be', 'Choose an institution type', 'outside Bangladesh', 'full http\\(s\\)', 'Year must be']) assert.match(body, new RegExp(m));
  assert.equal(rows(env, 'SELECT COUNT(*) c FROM institutions')[0].c, 0);
});

test('create: forged district id and half coordinates rejected', async () => {
  const env = mk(), c = await asRole(env, 'editor');
  assert.match(await (await post(env, c, '/console/institutions', { ...good, district_id: '9999' })).text(), /Unknown district/);
  assert.match(await (await post(env, c, '/console/institutions', { ...good, latitude: '23.7' })).text(), /both latitude and longitude/);
});

test('duplicates: same EIIN is blocked; same name+district warns until confirmed', async () => {
  const env = mk(), c = await asRole(env, 'editor');
  await post(env, c, '/console/institutions', good);
  const sameEiin = await post(env, c, '/console/institutions', { ...good, name_en: 'Different Name College', name_bn: '' });
  assert.equal(sameEiin.status, 409); assert.match(await sameEiin.text(), /EIIN already belongs/);
  const sameName = await post(env, c, '/console/institutions', { ...good, eiin: '' });
  assert.equal(sameName.status, 409); assert.match(await sameName.text(), /Possible duplicate/);
  assert.equal(rows(env, 'SELECT COUNT(*) c FROM institutions')[0].c, 1);
  const ok = await post(env, c, '/console/institutions', { ...good, eiin: '', confirm_duplicate: '1' });
  assert.equal(ok.status, 303);
  const slugs = rows(env, 'SELECT slug FROM institutions ORDER BY id').map((x) => x.slug);
  assert.equal(new Set(slugs).size, 2);
});

test('roles: viewer can read but not write; reviewer cannot create; only owner/admin publish', async () => {
  const env = mk(), v = await asRole(env, 'viewer'), rv = await asRole(env, 'reviewer'), ed = await asRole(env, 'editor');
  assert.equal((await get(env, v, '/console/institutions')).status, 200);
  assert.equal((await post(env, v, '/console/institutions', good)).status, 403);
  assert.equal((await post(env, rv, '/console/institutions', good)).status, 403);
  const id = idOf(await post(env, ed, '/console/institutions', good));
  assert.equal((await post(env, ed, `/console/institutions/${id}/publish`, { action: 'publish' })).status, 403);
  assert.equal((await post(env, v, `/console/institutions/${id}/verify`, { status: 'pending' })).status, 403);
  assert.equal((await get(env, v, '/console/institutions/new')).status, 403);
});

test('CSRF and auth: foreign origin refused; no session redirected/401', async () => {
  const env = mk(), c = await asRole(env, 'owner');
  assert.equal((await post(env, c, '/console/institutions', good, 'https://evil.example')).status, 403);
  assert.equal(rows(env, 'SELECT COUNT(*) c FROM institutions')[0].c, 0);
  assert.equal((await worker.fetch(new Request(ORIGIN + '/console/institutions'), env)).status, 302);
  assert.equal((await worker.fetch(new Request(ORIGIN + '/console/institutions', { method: 'POST', headers: { origin: ORIGIN } }), env)).status, 401);
});

test('verification needs a source; logs history; sets last_verified_at', async () => {
  const env = mk(), c = await asRole(env, 'owner');
  const id = idOf(await post(env, c, '/console/institutions', good));
  const no = await post(env, c, `/console/institutions/${id}/verify`, { status: 'verified' });
  assert.equal(no.status, 400); assert.match(await no.text(), /Add at least one source/);
  const bad = await post(env, c, `/console/institutions/${id}/sources`, { source_name: '', accessed_on: 'yesterday', source_url: 'ftp://x' });
  assert.equal(bad.status, 400);
  assert.equal((await post(env, c, `/console/institutions/${id}/sources`, { source_name: 'BANBEIS', source_url: 'https://banbeis.gov.bd', accessed_on: '2026-11-17' })).status, 303);
  assert.equal((await post(env, c, `/console/institutions/${id}/verify`, { status: 'verified', note: 'checked EIIN' })).status, 303);
  const i = rows(env, 'SELECT * FROM institutions WHERE id = ?', id)[0];
  assert.equal(i.verification_status, 'verified'); assert.ok(i.last_verified_at);
  const log = rows(env, 'SELECT * FROM verification_logs WHERE institution_id = ?', id)[0];
  assert.deepEqual([log.from_status, log.to_status, log.note], ['unverified', 'verified', 'checked EIIN']);
  assert.equal((await post(env, c, `/console/institutions/${id}/verify`, { status: 'bogus' })).status, 400);
});

test('publish gate: needs verified and enough completeness', async () => {
  const env = mk(), c = await asRole(env, 'owner');
  const id = idOf(await post(env, c, '/console/institutions', good));
  assert.match(await (await post(env, c, `/console/institutions/${id}/publish`, { action: 'publish' })).text(), /Only verified/);
  await post(env, c, `/console/institutions/${id}/sources`, { source_name: 'BANBEIS', accessed_on: '2026-11-17' });
  await post(env, c, `/console/institutions/${id}/verify`, { status: 'verified' });
  assert.match(await (await post(env, c, `/console/institutions/${id}/publish`, { action: 'publish' })).text(), /complete; 70% is needed/);
  const full = { ...good, established_year: '1990', website: 'https://example.bd', address: 'Main Road', summary: 'x'.repeat(220) };
  await post(env, c, `/console/institutions/${id}/edit`, full);              // edit resets verification (tested below)
  await post(env, c, `/console/institutions/${id}/verify`, { status: 'verified' });
  assert.equal((await post(env, c, `/console/institutions/${id}/publish`, { action: 'publish' })).status, 303);
  assert.equal(rows(env, 'SELECT publish_state FROM institutions WHERE id = ?', id)[0].publish_state, 'published');
});

test('editing a verified profile sends it back to pending and unpublishes; slug is kept', async () => {
  const env = mk(), c = await asRole(env, 'owner');
  const full = { ...good, established_year: '1990', website: 'https://example.bd', address: 'Main Road', summary: 'x'.repeat(220) };
  const id = idOf(await post(env, c, '/console/institutions', full));
  await post(env, c, `/console/institutions/${id}/sources`, { source_name: 'BANBEIS', accessed_on: '2026-11-17' });
  await post(env, c, `/console/institutions/${id}/verify`, { status: 'verified' });
  await post(env, c, `/console/institutions/${id}/publish`, { action: 'publish' });
  const slug = rows(env, 'SELECT slug FROM institutions WHERE id = ?', id)[0].slug;
  const r = await post(env, c, `/console/institutions/${id}/edit`, { ...full, address: 'New Road' });
  assert.match(r.headers.get('location'), /msg=reverted/);
  const i = rows(env, 'SELECT * FROM institutions WHERE id = ?', id)[0];
  assert.deepEqual([i.verification_status, i.publish_state, i.slug, i.address], ['pending', 'draft', slug, 'New Road']);
  const a = rows(env, "SELECT after_json FROM audit_logs WHERE action = 'update'")[0];
  assert.match(a.after_json, /New Road/);
  // a no-op save keeps pending as is (nothing verified to revert) and does not crash
  assert.equal((await post(env, c, `/console/institutions/${id}/edit`, { ...full, address: 'New Road' })).status, 303);
});

test('list: search by name, Bengali, EIIN; filters; pagination', async () => {
  const env = mk(), c = await asRole(env, 'owner');
  for (let n = 0; n < 30; n++) await post(env, c, '/console/institutions', { name_en: `Sample School ${n}`, type_id: '1', district_id: String(1 + (n % 3)) });
  await post(env, c, '/console/institutions', good);
  const text = async (q) => (await get(env, c, `/console/institutions?${q}`)).text();
  assert.match(await text('q=government+test'), /Government Test College/);
  assert.doesNotMatch(await text('q=government+test'), /Sample School/);
  assert.match(await text(`q=${encodeURIComponent('টেস্ট')}`), /Government Test College/);
  assert.match(await text('q=123456'), /Government Test College/);
  assert.match(await text('type=2'), /\(1\)/);
  const p1 = await text(''); assert.match(p1, /Page 1 of 2/); assert.match(p1, /Next/);
  assert.match(await text('page=2'), /Page 2 of 2/);
  assert.match(await text('page=999'), /Page 2 of 2/);
});

test('security: SQL-injection search is harmless; HTML in names is escaped', async () => {
  const env = mk(), c = await asRole(env, 'owner');
  await post(env, c, '/console/institutions', { name_en: '<script>alert(1)</script> School', type_id: '1' });
  const inj = await get(env, c, `/console/institutions?q=${encodeURIComponent("' OR 1=1; DROP TABLE institutions; --")}`);
  assert.equal(inj.status, 200); assert.match(await inj.text(), /No institutions match/);
  assert.equal(rows(env, 'SELECT COUNT(*) c FROM institutions')[0].c, 1);
  const page = await (await get(env, c, '/console/institutions')).text();
  assert.doesNotMatch(page, /<script>alert/); assert.match(page, /&lt;script&gt;/);
  const id = rows(env, 'SELECT id FROM institutions')[0].id;
  assert.doesNotMatch(await (await get(env, c, `/console/institutions/${id}`)).text(), /<script>alert/);
});

test('detail: unknown id and non-numeric id give 404', async () => {
  const env = mk(), c = await asRole(env, 'owner');
  assert.equal((await get(env, c, '/console/institutions/999')).status, 404);
  assert.equal((await get(env, c, '/console/institutions/abc')).status, 404);
});
