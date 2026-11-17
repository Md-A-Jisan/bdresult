import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { signToken, verifyToken } from '../src/lib/session.mjs';
import worker from '../src/worker.mjs';

// Real SQLite behind a D1-shaped adapter, with the real migrations applied.
function makeDb() {
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys=ON');
  for (const f of readdirSync('migrations').filter((x) => x.endsWith('.sql')).sort()) raw.exec(readFileSync(`migrations/${f}`, 'utf8'));
  const wrap = (st, args) => ({
    first: async () => st.get(...args) ?? null,
    all: async () => ({ results: st.all(...args) }),
    run: async () => { const r = st.run(...args); return { meta: { changes: r.changes } }; },
  });
  return { raw, prepare: (sql) => { const st = raw.prepare(sql); return { ...wrap(st, []), bind: (...a) => wrap(st, a) }; } };
}
const SECRET = 'x'.repeat(40);
const mkEnv = (db = makeDb()) => ({ DB: db, GITHUB_CLIENT_ID: 'cid', GITHUB_CLIENT_SECRET: 'csecret', SESSION_SECRET: SECRET, OWNER_GITHUB_LOGIN: 'Md-A-Jisan', ASSETS: { fetch: () => new Response('asset', { status: 404 }) } });
const ORIGIN = 'http://127.0.0.1:8787';
const req = (path, init = {}) => new Request(ORIGIN + path, init);
const cookiesOf = (res) => res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
const mockGitHub = (user) => { globalThis.fetch = async (u) => String(u).includes('access_token')
  ? new Response(JSON.stringify({ access_token: 'tok' })) : new Response(JSON.stringify(user)); };

async function signIn(env, user) {
  const r1 = await worker.fetch(req('/api/auth/login'), env);
  const state = new URL(r1.headers.get('location')).searchParams.get('state');
  mockGitHub(user);
  return worker.fetch(req(`/api/auth/callback?code=abc&state=${state}`, { headers: { cookie: cookiesOf(r1) } }), env);
}
const OWNER = { id: 286876546, login: 'Md-A-Jisan', name: 'Jisan' };

test('token: roundtrip, tamper, expiry, wrong secret', async () => {
  const t = await signToken({ uid: 1, exp: Date.now() + 1000 }, SECRET);
  assert.equal((await verifyToken(t, SECRET)).uid, 1);
  assert.equal(await verifyToken(t.slice(0, -2) + 'AA', SECRET), null);
  assert.equal(await verifyToken(await signToken({ uid: 1, exp: Date.now() - 1 }, SECRET), SECRET), null);
  assert.equal(await verifyToken(t, 'y'.repeat(40)), null);
  assert.equal(await verifyToken(t, ''), null);
  assert.equal(await verifyToken('garbage', SECRET), null);
});

test('login redirects to GitHub with identity-only scope and a state cookie', async () => {
  const r = await worker.fetch(req('/api/auth/login'), mkEnv());
  assert.equal(r.status, 302);
  const u = new URL(r.headers.get('location'));
  assert.equal(u.origin + u.pathname, 'https://github.com/login/oauth/authorize');
  assert.equal(u.searchParams.get('scope'), 'read:user');
  assert.equal(u.searchParams.get('redirect_uri'), `${ORIGIN}/api/auth/callback`);
  assert.match(r.headers.getSetCookie()[0], /HttpOnly/);
});

test('login is refused when secrets are missing or too short', async () => {
  const env = mkEnv(); env.SESSION_SECRET = 'short';
  assert.equal((await worker.fetch(req('/api/auth/login'), env)).status, 503);
});

test('callback rejects missing or mismatched state', async () => {
  const env = mkEnv();
  assert.equal((await worker.fetch(req('/api/auth/callback?code=a&state=b'), env)).status, 400);
  assert.equal((await worker.fetch(req('/api/auth/callback?code=a&state=b', { headers: { cookie: 'bdr_oauth_state=zzz' } }), env)).status, 400);
});

test('first sign-in by OWNER_GITHUB_LOGIN creates the owner; dashboard then loads', async () => {
  const env = mkEnv();
  const r = await signIn(env, OWNER);
  assert.equal(r.status, 302); assert.equal(r.headers.get('location'), '/console/');
  const sess = cookiesOf(r);
  const me = await worker.fetch(req('/api/me', { headers: { cookie: sess } }), env);
  assert.deepEqual(await me.json(), { login: 'Md-A-Jisan', role: 'owner' });
  const d = await worker.fetch(req('/console/', { headers: { cookie: sess } }), env);
  const body = await d.text();
  assert.equal(d.status, 200); assert.match(body, /Total institutions/); assert.match(body, /login admin_user/);
  assert.match(d.headers.get('content-security-policy'), /default-src 'none'/);
  assert.equal(d.headers.get('x-frame-options'), 'DENY');
});

test('an unlisted GitHub account is refused and gets no session', async () => {
  const env = mkEnv();
  await signIn(env, OWNER);                      // owner exists now
  const r = await signIn(env, { id: 999, login: 'stranger' });
  assert.equal(r.status, 403);
  assert.ok(!r.headers.getSetCookie().some((c) => c.startsWith('bdr_session=') && !c.includes('Max-Age=0')));
});

test('OWNER_GITHUB_LOGIN cannot be used to take over once an owner exists', async () => {
  const env = mkEnv();
  await signIn(env, OWNER);
  const r = await signIn(env, { id: 5, login: 'md-a-jisan' });   // same name, different GitHub id
  assert.equal(r.status, 403);
});

test('deactivating an admin ends their session immediately', async () => {
  const env = mkEnv();
  const sess = cookiesOf(await signIn(env, OWNER));
  env.DB.raw.exec('UPDATE admin_users SET active = 0');
  assert.equal((await worker.fetch(req('/api/me', { headers: { cookie: sess } }), env)).status, 401);
});

test('console without a session shows sign-in, not data', async () => {
  const body = await (await worker.fetch(req('/console/'), mkEnv())).text();
  assert.match(body, /Sign in with GitHub/); assert.doesNotMatch(body, /Total institutions/);
});

test('forged session cookie is rejected', async () => {
  const env = mkEnv();
  const forged = await signToken({ uid: 1, exp: Date.now() + 99999 }, 'attacker'.repeat(6));
  assert.equal((await worker.fetch(req('/api/me', { headers: { cookie: `bdr_session=${forged}` } }), env)).status, 401);
});

test('logout: wrong origin refused; right origin clears the cookie', async () => {
  const env = mkEnv();
  const sess = cookiesOf(await signIn(env, OWNER));
  const bad = await worker.fetch(req('/api/auth/logout', { method: 'POST', headers: { cookie: sess, origin: 'https://evil.example' } }), env);
  assert.equal(bad.status, 403);
  const ok = await worker.fetch(req('/api/auth/logout', { method: 'POST', headers: { cookie: sess, origin: ORIGIN } }), env);
  assert.equal(ok.status, 303); assert.match(ok.headers.getSetCookie()[0], /Max-Age=0/);
  assert.equal((await worker.fetch(req('/api/auth/logout'), env)).status, 405);
});

test('HTML in admin-controlled text is escaped', async () => {
  const env = mkEnv();
  const sess = cookiesOf(await signIn(env, OWNER));
  env.DB.raw.exec("UPDATE admin_users SET display_name = '<script>alert(1)</script>'");
  const body = await (await worker.fetch(req('/console/', { headers: { cookie: sess } }), env)).text();
  assert.doesNotMatch(body, /<script>alert/); assert.match(body, /&lt;script&gt;/);
});

test('unknown /api path gives JSON 404', async () => {
  const r = await worker.fetch(req('/api/nope'), mkEnv());
  assert.equal(r.status, 404); assert.deepEqual(await r.json(), { error: 'not_found' });
});
