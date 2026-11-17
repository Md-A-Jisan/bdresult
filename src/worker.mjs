// bdresult.me Worker. Static pages are served by Cloudflare directly; this runs only for the routes listed
// in wrangler.jsonc "run_worker_first". Routes not implemented yet fall through to the static 404 page.
import { getSession, login, callback, logout } from './lib/auth.mjs';
import { loginPage, dashboardPage, loadStats, CONSOLE_HEADERS } from './lib/console.mjs';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
  });
const html = (body, status = 200) => new Response(body, { status, headers: CONSOLE_HEADERS });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const p = url.pathname;
    const m = request.method;

    if (p === '/api/health') {
      if (m !== 'GET' && m !== 'HEAD') return json({ error: 'method_not_allowed' }, 405);
      try {
        const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM institution_types').first();
        return json({ ok: true, institution_types: row.n });
      } catch {
        return json({ ok: false }, 503); // details go to logs, never to the client
      }
    }

    try {
      if (p === '/api/auth/login' && m === 'GET') return await login(request, env);
      if (p === '/api/auth/callback' && m === 'GET') return await callback(request, env);
      if (p === '/api/auth/logout') return m === 'POST' ? await logout(request, env) : json({ error: 'method_not_allowed' }, 405);

      if (p === '/api/me') {
        const user = await getSession(request, env);
        return user ? json({ login: user.github_login, role: user.role }) : json({ error: 'unauthorized' }, 401);
      }

      if (p === '/console') return Response.redirect(`${url.origin}/console/`, 301);
      if (p === '/console/') {
        const user = await getSession(request, env);
        if (!user) return html(loginPage());
        return html(dashboardPage(user, await loadStats(env.DB)));
      }
    } catch {
      return json({ error: 'server_error' }, 500);
    }

    if (p.startsWith('/api/')) return json({ error: 'not_found' }, 404);
    return env.ASSETS.fetch(request);
  },
};
