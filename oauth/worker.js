// Cloudflare Worker: GitHub OAuth for Decap CMS (/admin). Env: GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/auth') {
      const state = crypto.randomUUID();
      const q = new URLSearchParams({ client_id: env.GITHUB_CLIENT_ID, scope: 'repo,user', state, redirect_uri: url.origin + '/callback' });
      return new Response(null, { status: 302, headers: { Location: 'https://github.com/login/oauth/authorize?' + q, 'Set-Cookie': `st=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600` } });
    }
    if (url.pathname === '/callback') {
      const code = url.searchParams.get('code');
      const ck = (req.headers.get('Cookie') || '').match(/st=([^;]+)/);
      if (!code || !ck || ck[1] !== url.searchParams.get('state')) return new Response('Invalid state', { status: 400 });
      const r = await fetch('https://github.com/login/oauth/access_token', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code }) });
      const j = await r.json();
      const ok = !!j.access_token;
      const data = JSON.stringify(ok ? { token: j.access_token, provider: 'github' } : { error: j.error || 'failed' });
      const html = `<!doctype html><script>(function(){function m(e){window.opener.postMessage('authorization:github:${ok ? 'success' : 'error'}:'+${JSON.stringify(data)},e.origin)}window.addEventListener('message',m,false);window.opener.postMessage('authorizing:github','*')})()</script>`;
      return new Response(html, { headers: { 'Content-Type': 'text/html' } });
    }
    return new Response('bdresult auth', { status: 200 });
  }
};
