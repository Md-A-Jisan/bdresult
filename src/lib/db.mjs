// Pure helpers + thin D1 access layer. All SQL is parameterized; nothing else in the app talks to D1 directly.

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';

/** Normalize a name for search and duplicate detection (not for display). */
export function normalizeName(s) {
  if (!s) return '';
  return String(s)
    .normalize('NFC')
    .replace(/[\u200C\u200D]/g, '')                       // joiners vary between sources
    .replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)))  // Bengali digits -> ASCII
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ')                // keep letters, digits and Bengali vowel marks
    .replace(/\s+/g, ' ')
    .trim();
}

/** URL slug from an English name; the caller adds a district suffix if the slug is already taken. */
export function slugify(s, max = 100) {
  return String(s || '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '');
}

/** 0-100 completeness score. Weights sum to 100. Publishing thresholds are decided by the app, not here. */
export function completeness(i, { sourceCount = 0 } = {}) {
  let n = 0;
  if (i.eiin) n += 15;
  if (i.name_bn) n += 5;
  if (i.district_id) n += 10;
  if (i.upazila_id) n += 5;
  if (i.address) n += 10;
  if (i.established_year) n += 5;
  if (i.management_type) n += 5;
  if (i.website) n += 5;
  if (i.summary && i.summary.trim().length >= 200) n += 15;
  if (sourceCount > 0) n += 15;
  if (i.verification_status === 'verified') n += 10;
  return n;
}

/** Possible duplicates: same EIIN, or same normalized name in the same district. */
export async function findDuplicates(db, { eiin, name_norm, district_id, excludeId = 0 }) {
  const out = [];
  if (eiin) {
    const r = await db.prepare('SELECT id, slug, name_en FROM institutions WHERE eiin = ?1 AND id != ?2').bind(eiin, excludeId).all();
    out.push(...r.results.map((x) => ({ ...x, reason: 'same_eiin' })));
  }
  if (name_norm) {
    const r = await db.prepare(
      'SELECT id, slug, name_en FROM institutions WHERE name_norm = ?1 AND district_id IS ?2 AND id != ?3'
    ).bind(name_norm, district_id ?? null, excludeId).all();
    out.push(...r.results.map((x) => ({ ...x, reason: 'same_name_same_district' })));
    const a = await db.prepare(
      'SELECT i.id, i.slug, i.name_en FROM institution_aliases a JOIN institutions i ON i.id = a.institution_id WHERE a.alias_norm = ?1 AND i.id != ?2'
    ).bind(name_norm, excludeId).all();
    out.push(...a.results.map((x) => ({ ...x, reason: 'matches_alias' })));
  }
  return out;
}
