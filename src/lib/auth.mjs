// GitHub OAuth sign-in for the admin console. Authorization is decided HERE, server-side, from the admin_users table.
import { signToken, verifyToken, parseCookies, cookie, randomToken } from './session.mjs';

export const SESSION_COOKIE = 'bdr_session';
const STATE_COOKIE = 'bdr_oauth_state';
const SESSION_SECONDS = 8 * 3600;
export const ROLES = ['owner', 'admin', 'editor', 'reviewer', 'viewer'];

const configured = (env) => Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET && env.SESSION_SECRET && env.SESSION_SECRET.length >= 32);
const isHttps = (url) => url.protocol === 'https:';
const noStore = { 'cache-control': 'no-store' };

function reply(body, status, cookies = [], extra = {}) {
  const h = new Headers({ 'content-type': 'text/plain; charset=utf-8', ...noStore, ...extra });
  cookies.forEach((c) => h.append('set-cookie', c));
  return new Response(body, { status, headers: h });
}
function redirect(location, cookies = [], status = 302) {
  const h = new Headers({ location, ...noStore });
  cookies.forEach((c) => h.append('set-cookie', c));
  return new Response(null, { status, headers: h });
}

/** Current admin from the session cookie, re-checked against the DB on every request (so deactivation is immediate). */
export async function getSession(request, env) {
  const token = parseCookies(request.headers.get('cookie'))[SESSION_COOKIE];
  const p = await verifyToken(token, env.SESSION_SECRET);
  if (!p) return null;
  return (await env.DB.prepare('SELECT id, github_login, display_name, role FROM admin_users WHERE id = ?1 AND active = 1').bind(p.uid).first()) || null;
}

export const hasRole = (user, allowed) => Boolean(user && allowed.includes(user.role));

/** POSTs must come from our own origin (defence in depth on top of SameSite=Lax). */
export function sameOrigin(request) {
  const origin = request.headers.get('origin');
  return Boolean(origin) && origin === new URL(request.url).origin;
}

export async function audit(env, adminId, action, entityType, entityId = null, after = null) {
  await env.DB.prepare('INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, after_json) VALUES (?1, ?2, ?3, ?4, ?5)')
    .bind(adminId, action, entityType, entityId, after ? JSON.stringify(after) : null).run();
}

export async function login(request, env) {
  if (!configured(env)) return reply('Login is not configured.', 503);
  const url = new URL(request.url);
  const state = randomToken(24);
  const q = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: `${url.origin}/api/auth/callback`,
    scope: 'read:user',          // identity only: no access to any repository
    state,
    allow_signup: 'false',
  });
  return redirect(`https://github.com/login/oauth/authorize?${q}`, [cookie(STATE_COOKIE, state, { maxAge: 600, path: '/api/auth', secure: isHttps(url) })]);
}

export async function callback(request, env) {
  if (!configured(env)) return reply('Login is not configured.', 503);
  const url = new URL(request.url);
  const secure = isHttps(url);
  const clearState = cookie(STATE_COOKIE, '', { maxAge: 0, path: '/api/auth', secure });
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const saved = parseCookies(request.headers.get('cookie'))[STATE_COOKIE];
  if (!code || !state || !saved || state !== saved) return reply('Invalid login attempt. Please start again.', 400, [clearState]);

  let gh;
  try {
    const tr = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json', 'user-agent': 'bdresult-console' },
      body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code, redirect_uri: `${url.origin}/api/auth/callback` }),
    });
    const tok = await tr.json();
    if (!tok.access_token) return reply('GitHub sign-in failed.', 401, [clearState]);
    const ur = await fetch('https://api.github.com/user', {
      headers: { authorization: `Bearer ${tok.access_token}`, accept: 'application/vnd.github+json', 'user-agent': 'bdresult-console' },
    });
    gh = await ur.json();
    if (!ur.ok || !gh.id || !gh.login) return reply('GitHub sign-in failed.', 401, [clearState]);
  } catch {
    return reply('Could not reach GitHub. Please try again.', 502, [clearState]);
  }

  // Match by immutable GitHub id first; a pre-added login (no id yet) is claimed on first sign-in.
  let admin = await env.DB.prepare('SELECT * FROM admin_users WHERE github_id = ?1').bind(gh.id).first();
  if (!admin) {
    admin = await env.DB.prepare('SELECT * FROM admin_users WHERE github_id IS NULL AND github_login = ?1').bind(gh.login).first();
    if (admin) await env.DB.prepare('UPDATE admin_users SET github_id = ?1 WHERE id = ?2').bind(gh.id, admin.id).run();
  }
  // One-time bootstrap: the very first owner, only while the table is empty and the login matches OWNER_GITHUB_LOGIN.
  if (!admin && env.OWNER_GITHUB_LOGIN && gh.login.toLowerCase() === env.OWNER_GITHUB_LOGIN.toLowerCase()) {
    const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM admin_users').first();
    if (n === 0) {
      await env.DB.prepare("INSERT INTO admin_users (github_login, github_id, display_name, role) VALUES (?1, ?2, ?3, 'owner')").bind(gh.login, gh.id, gh.name || gh.login).run();
      admin = await env.DB.prepare('SELECT * FROM admin_users WHERE github_id = ?1').bind(gh.id).first();
    }
  }
  if (!admin || !admin.active) return reply('This GitHub account is not authorized for the console.', 403, [clearState]);

  const now = Date.now();
  const token = await signToken({ uid: admin.id, iat: now, exp: now + SESSION_SECONDS * 1000 }, env.SESSION_SECRET);
  await env.DB.prepare("UPDATE admin_users SET last_login_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?1").bind(admin.id).run();
  await audit(env, admin.id, 'login', 'admin_user', String(admin.id));
  return redirect('/console/', [clearState, cookie(SESSION_COOKIE, token, { maxAge: SESSION_SECONDS, secure })]);
}

export async function logout(request, env) {
  if (!sameOrigin(request)) return reply('Forbidden', 403);
  const user = await getSession(request, env);
  if (user) await audit(env, user.id, 'logout', 'admin_user', String(user.id));
  return redirect('/console/', [cookie(SESSION_COOKIE, '', { maxAge: 0, secure: isHttps(new URL(request.url)) })], 303);
}
