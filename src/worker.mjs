// bdresult.me Worker. Static pages are served by Cloudflare directly; this runs only for the routes listed
// in wrangler.jsonc "run_worker_first". Routes not implemented yet fall through to the static 404 page.

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
  });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      if (request.method !== 'GET' && request.method !== 'HEAD') return json({ error: 'method_not_allowed' }, 405);
      try {
        const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM institution_types').first();
        return json({ ok: true, institution_types: row.n });
      } catch {
        return json({ ok: false }, 503); // details go to logs, never to the client
      }
    }

    return env.ASSETS.fetch(request);
  },
};
