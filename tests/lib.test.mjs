import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeName, slugify, completeness, findDuplicates } from '../src/lib/db.mjs';
import worker from '../src/worker.mjs';

test('normalizeName: case, punctuation, spacing', () => {
  assert.equal(normalizeName('  Govt.  Kadam-Rasul   College '), 'govt kadam rasul college');
});
test('normalizeName: Bengali digits and joiners', () => {
  assert.equal(normalizeName('সরকারি স্কুল ১২'), 'সরকারি স্কুল 12');
  assert.equal(normalizeName('র\u200Dে'), normalizeName('রে'));
});
test('normalizeName keeps Bengali vowel signs', () => assert.equal(normalizeName('কলেজ'), 'কলেজ'));
test('slugify', () => {
  assert.equal(slugify("Philipnagar High School & College!"), 'philipnagar-high-school-and-college');
  assert.equal(slugify('  --x--  '), 'x');
  assert.equal(slugify('বাংলা'), '');
});
test('completeness weights', () => {
  assert.equal(completeness({}), 0);
  const full = { eiin: '123456', name_bn: 'ক', district_id: 1, upazila_id: 1, address: 'a', established_year: 1990,
    management_type: 'government', website: 'https://x.bd', summary: 'x'.repeat(200), verification_status: 'verified' };
  assert.equal(completeness(full, { sourceCount: 1 }), 100);
  assert.equal(completeness({ ...full, summary: 'short' }, { sourceCount: 1 }), 85);
});
const mockDb = (rows) => ({ prepare: () => ({ bind: () => ({ all: async () => ({ results: rows }), first: async () => rows[0] }) }), });
test('findDuplicates tags the reason', async () => {
  const d = await findDuplicates(mockDb([{ id: 9, slug: 's', name_en: 'N' }]), { eiin: '123456', name_norm: 'n', district_id: 1 });
  assert.deepEqual(d.map((x) => x.reason), ['same_eiin', 'same_name_same_district', 'matches_alias']);
});
test('worker /api/health ok', async () => {
  const env = { DB: { prepare: () => ({ first: async () => ({ n: 5 }) }) }, ASSETS: { fetch: () => new Response('asset') } };
  const r = await worker.fetch(new Request('https://bdresult.me/api/health'), env);
  assert.equal(r.status, 200); assert.deepEqual(await r.json(), { ok: true, institution_types: 5 });
});
test('worker /api/health hides DB errors', async () => {
  const env = { DB: { prepare: () => ({ first: async () => { throw new Error('secret detail'); } }) }, ASSETS: { fetch: () => new Response('asset') } };
  const r = await worker.fetch(new Request('https://bdresult.me/api/health'), env);
  assert.equal(r.status, 503); assert.equal(await r.text(), '{"ok":false}');
});
test('worker rejects POST on health', async () => {
  const r = await worker.fetch(new Request('https://bdresult.me/api/health', { method: 'POST' }), {});
  assert.equal(r.status, 405);
});
test('worker passes other routes to static assets', async () => {
  const env = { ASSETS: { fetch: () => new Response('asset', { status: 404 }) } };
  const r = await worker.fetch(new Request('https://bdresult.me/institutions/'), env);
  assert.equal(r.status, 404); assert.equal(await r.text(), 'asset');
});
