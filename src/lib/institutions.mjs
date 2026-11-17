// All institution queries. Parameterized SQL only.
import { normalizeName, slugify, completeness, findDuplicates } from './db.mjs';

export const PUBLISH_MIN = 70;                       // completeness needed before a profile may be published
export const STATUSES = ['unverified', 'pending', 'verified', 'disputed'];
export const PER_PAGE = 25;
const FIELDS = ['eiin', 'name_en', 'name_bn', 'type_id', 'division_id', 'district_id', 'address', 'postal_code', 'latitude', 'longitude', 'coords_verified', 'established_year', 'management_type', 'website', 'summary'];

export async function lookups(db) {
  const types = (await db.prepare('SELECT id, name_en FROM institution_types ORDER BY sort_order').all()).results;
  const districts = (await db.prepare('SELECT d.id AS id, d.name_en AS name_en, v.name_en AS division FROM districts d JOIN divisions v ON v.id = d.division_id ORDER BY d.name_en').all()).results;
  return { types, districts };
}

export async function listInstitutions(db, { q = '', type = '', district = '', status = '', publish = '', page = 1 }) {
  const where = []; const args = [];
  const query = q.trim();
  if (query) {
    const esc = (s) => `%${s.replace(/[\\%_]/g, '\\$&')}%`;
    const qn = normalizeName(query);
    where.push("(i.name_norm LIKE ? ESCAPE '\\' OR i.name_bn LIKE ? ESCAPE '\\' OR i.eiin LIKE ? ESCAPE '\\' OR i.id IN (SELECT institution_id FROM institution_aliases WHERE alias_norm LIKE ? ESCAPE '\\'))");
    args.push(esc(qn), esc(query), esc(query), esc(qn));
  }
  if (Number(type)) { where.push('i.type_id = ?'); args.push(Number(type)); }
  if (Number(district)) { where.push('i.district_id = ?'); args.push(Number(district)); }
  if (STATUSES.includes(status)) { where.push('i.verification_status = ?'); args.push(status); }
  if (['draft', 'published', 'archived'].includes(publish)) { where.push('i.publish_state = ?'); args.push(publish); }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (await db.prepare(`SELECT COUNT(*) AS n FROM institutions i ${w}`).bind(...args).first()).n;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const pg = Math.min(Math.max(1, Number(page) || 1), pages);
  const rows = (await db.prepare(
    `SELECT i.id AS id, i.eiin AS eiin, i.name_en AS name_en, i.name_bn AS name_bn, i.verification_status AS verification_status, i.publish_state AS publish_state,
            i.completeness AS completeness, t.name_en AS type_name, d.name_en AS district_name
     FROM institutions i JOIN institution_types t ON t.id = i.type_id LEFT JOIN districts d ON d.id = i.district_id
     ${w} ORDER BY i.updated_at DESC, i.id DESC LIMIT ? OFFSET ?`).bind(...args, PER_PAGE, (pg - 1) * PER_PAGE).all()).results;
  return { rows, total, page: pg, pages };
}

export const getInstitution = (db, id) => db.prepare(
  `SELECT i.*, t.name_en AS type_name, d.name_en AS district_name, v.name_en AS division_name
   FROM institutions i JOIN institution_types t ON t.id = i.type_id LEFT JOIN districts d ON d.id = i.district_id LEFT JOIN divisions v ON v.id = i.division_id WHERE i.id = ?1`).bind(id).first();

export const listSources = async (db, id) => (await db.prepare('SELECT * FROM institution_sources WHERE institution_id = ?1 ORDER BY id DESC').bind(id).all()).results;
export const listVerificationLog = async (db, id) => (await db.prepare(
  'SELECT l.*, u.github_login AS admin FROM verification_logs l LEFT JOIN admin_users u ON u.id = l.admin_id WHERE l.institution_id = ?1 ORDER BY l.id DESC LIMIT 20').bind(id).all()).results;

async function uniqueSlug(db, base) {
  const root = slugify(base) || 'institution';
  for (let n = 1; n < 100; n++) {
    const s = n === 1 ? root : `${root}-${n}`.slice(0, 120);
    if (!(await db.prepare('SELECT 1 AS x FROM institutions WHERE slug = ?1').bind(s).first())) return s;
  }
  throw new Error('could not allocate slug');
}

export async function possibleDuplicates(db, v, excludeId = 0) {
  const out = await findDuplicates(db, { eiin: v.eiin, name_norm: normalizeName(v.name_en), district_id: v.district_id, excludeId });
  if (v.name_bn) out.push(...(await findDuplicates(db, { name_norm: normalizeName(v.name_bn), district_id: v.district_id, excludeId })));
  const seen = new Set();
  return out.filter((d) => { const k = `${d.id}:${d.reason}`; return seen.has(k) ? false : seen.add(k); });
}

async function syncBnAlias(db, id, oldBn, newBn) {
  if (oldBn && oldBn !== newBn) await db.prepare('DELETE FROM institution_aliases WHERE institution_id = ?1 AND alias_norm = ?2').bind(id, normalizeName(oldBn)).run();
  if (newBn) await db.prepare('INSERT OR IGNORE INTO institution_aliases (institution_id, alias, alias_norm) VALUES (?1, ?2, ?3)').bind(id, newBn, normalizeName(newBn)).run();
}

export async function recompute(db, id) {
  const i = await db.prepare('SELECT * FROM institutions WHERE id = ?1').bind(id).first();
  const { n } = await db.prepare('SELECT COUNT(*) AS n FROM institution_sources WHERE institution_id = ?1').bind(id).first();
  const score = completeness(i, { sourceCount: n });
  await db.prepare('UPDATE institutions SET completeness = ?1 WHERE id = ?2').bind(score, id).run();
  return score;
}

export async function createInstitution(db, v) {
  const district = v.district_id ? await db.prepare('SELECT slug FROM districts WHERE id = ?1').bind(v.district_id).first() : null;
  const slug = await uniqueSlug(db, `${v.name_en} ${district ? district.slug : ''}`);
  await db.prepare(
    `INSERT INTO institutions (eiin, slug, name_en, name_bn, name_norm, type_id, division_id, district_id, address, postal_code, latitude, longitude, coords_verified, established_year, management_type, website, summary)
     VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17)`)
    .bind(v.eiin, slug, v.name_en, v.name_bn, normalizeName(v.name_en), v.type_id, v.division_id, v.district_id, v.address, v.postal_code, v.latitude, v.longitude, v.coords_verified, v.established_year, v.management_type, v.website, v.summary).run();
  const { id } = await db.prepare('SELECT id FROM institutions WHERE slug = ?1').bind(slug).first();
  await syncBnAlias(db, id, null, v.name_bn);
  await recompute(db, id);
  return id;
}

/** Updates facts. A verified profile whose facts change goes back to 'pending' and is unpublished (trust first). */
export async function updateInstitution(db, id, v, adminId) {
  const before = await getInstitution(db, id);
  const changed = FIELDS.some((k) => (before[k] ?? null) !== (v[k] ?? null));
  await db.prepare(
    `UPDATE institutions SET eiin=?1, name_en=?2, name_bn=?3, name_norm=?4, type_id=?5, division_id=?6, district_id=?7, address=?8, postal_code=?9,
       latitude=?10, longitude=?11, coords_verified=?12, established_year=?13, management_type=?14, website=?15, summary=?16 WHERE id=?17`)
    .bind(v.eiin, v.name_en, v.name_bn, normalizeName(v.name_en), v.type_id, v.division_id, v.district_id, v.address, v.postal_code, v.latitude, v.longitude, v.coords_verified, v.established_year, v.management_type, v.website, v.summary, id).run();
  await syncBnAlias(db, id, before.name_bn, v.name_bn);
  let score = await recompute(db, id);
  let reverted = false;
  if (changed && before.verification_status === 'verified') {
    await db.prepare("UPDATE institutions SET verification_status='pending', publish_state=CASE WHEN publish_state='published' THEN 'draft' ELSE publish_state END WHERE id=?1").bind(id).run();
    await db.prepare("INSERT INTO verification_logs (institution_id, admin_id, from_status, to_status, note) VALUES (?1,?2,'verified','pending','Facts edited after verification: needs re-verification')").bind(id, adminId).run();
    reverted = true;
  } else {
    const row = await db.prepare('SELECT publish_state, completeness FROM institutions WHERE id = ?1').bind(id).first();
    if (row.publish_state === 'published' && row.completeness < PUBLISH_MIN) await db.prepare("UPDATE institutions SET publish_state='draft' WHERE id=?1").bind(id).run();
  }
  return { before, reverted, score };
}

export async function addSource(db, id, s) {
  await db.prepare('INSERT INTO institution_sources (institution_id, field_name, source_name, source_url, accessed_on, note) VALUES (?1,?2,?3,?4,?5,?6)')
    .bind(id, s.field_name, s.source_name, s.source_url, s.accessed_on, s.note).run();
  return recompute(db, id);
}

export async function setVerification(db, id, to, note, adminId) {
  if (!STATUSES.includes(to)) return { error: 'Unknown status.' };
  const cur = await getInstitution(db, id);
  if (cur.verification_status === to) return { error: 'Status is already ' + to + '.' };
  const { n } = await db.prepare('SELECT COUNT(*) AS n FROM institution_sources WHERE institution_id = ?1').bind(id).first();
  if (to === 'verified' && n === 0) return { error: 'Add at least one source before marking an institution verified.' };
  await db.prepare(
    `UPDATE institutions SET verification_status = ?1, last_verified_at = CASE WHEN ?1 = 'verified' THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE last_verified_at END,
       publish_state = CASE WHEN ?1 != 'verified' AND publish_state = 'published' THEN 'draft' ELSE publish_state END WHERE id = ?2`).bind(to, id).run();
  await db.prepare('INSERT INTO verification_logs (institution_id, admin_id, from_status, to_status, note) VALUES (?1,?2,?3,?4,?5)').bind(id, adminId, cur.verification_status, to, note || null).run();
  await recompute(db, id);
  return { from: cur.verification_status, to };
}

export async function setPublish(db, id, action) {
  const cur = await getInstitution(db, id);
  if (action === 'publish') {
    if (cur.verification_status !== 'verified') return { error: 'Only verified institutions can be published.' };
    if (cur.completeness < PUBLISH_MIN) return { error: `Profile is ${cur.completeness}% complete; ${PUBLISH_MIN}% is needed to publish.` };
    await db.prepare("UPDATE institutions SET publish_state='published' WHERE id=?1").bind(id).run();
  } else if (action === 'unpublish') await db.prepare("UPDATE institutions SET publish_state='draft' WHERE id=?1").bind(id).run();
  else if (action === 'archive') await db.prepare("UPDATE institutions SET publish_state='archived' WHERE id=?1").bind(id).run();
  else return { error: 'Unknown action.' };
  return { from: cur.publish_state, to: action === 'publish' ? 'published' : action === 'unpublish' ? 'draft' : 'archived' };
}
