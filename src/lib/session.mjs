// Signed, stateless session tokens (HMAC-SHA256) + cookie helpers. Uses WebCrypto only.
const enc = new TextEncoder();
const dec = new TextDecoder();

export const b64url = {
  enc: (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  dec: (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)),
};

const key = (secret, usage) => crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [usage]);

export function randomToken(bytes = 24) {
  return b64url.enc(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function signToken(payload, secret) {
  const body = b64url.enc(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign('HMAC', await key(secret, 'sign'), enc.encode(body));
  return `${body}.${b64url.enc(sig)}`;
}

/** Returns the payload, or null if missing/forged/expired. Never throws. */
export async function verifyToken(token, secret, now = Date.now()) {
  if (typeof token !== 'string' || !secret) return null;
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  try {
    // crypto.subtle.verify compares in constant time
    const ok = await crypto.subtle.verify('HMAC', await key(secret, 'verify'), b64url.dec(parts[1]), enc.encode(parts[0]));
    if (!ok) return null;
    const p = JSON.parse(dec.decode(b64url.dec(parts[0])));
    return p && typeof p.exp === 'number' && p.exp > now ? p : null;
  } catch { return null; }
}

export function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

export function cookie(name, value, { maxAge, path = '/', secure = true } = {}) {
  return `${name}=${value}; Path=${path}; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}
