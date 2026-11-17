// Server-side validation for institution forms. Never trusts the client: division is derived from the district.
export const MGMT = ['government', 'non_government', 'private', 'autonomous', 'other'];
const str = (f, k) => { const v = f.get(k); return typeof v === 'string' ? v.trim() : ''; };
const num = (s) => (s === '' ? null : Number(s));

export async function validateInstitution(f, db, { currentYear = new Date().getUTCFullYear() } = {}) {
  const e = {}; const v = {};
  v.name_en = str(f, 'name_en');
  if (v.name_en.length < 3 || v.name_en.length > 200) e.name_en = 'English name is required (3–200 characters).';
  v.name_bn = str(f, 'name_bn') || null;
  if (v.name_bn && v.name_bn.length > 200) e.name_bn = 'Bengali name is too long (max 200).';
  v.eiin = str(f, 'eiin') || null;
  if (v.eiin && !/^\d{5,7}$/.test(v.eiin)) e.eiin = 'EIIN must be 5–7 digits.';

  v.type_id = Number(str(f, 'type_id'));
  if (!Number.isInteger(v.type_id) || !(await db.prepare('SELECT 1 AS ok FROM institution_types WHERE id = ?1').bind(v.type_id).first())) e.type_id = 'Choose an institution type.';

  v.district_id = null; v.division_id = null;
  const did = str(f, 'district_id');
  if (did) {
    const d = Number.isInteger(Number(did)) ? await db.prepare('SELECT id, division_id FROM districts WHERE id = ?1').bind(Number(did)).first() : null;
    if (d) { v.district_id = d.id; v.division_id = d.division_id; } else e.district_id = 'Unknown district.';
  }
  v.address = str(f, 'address') || null;
  if (v.address && v.address.length > 500) e.address = 'Address is too long (max 500).';
  v.postal_code = str(f, 'postal_code') || null;
  if (v.postal_code && !/^\d{4}$/.test(v.postal_code)) e.postal_code = 'Postal code must be 4 digits.';

  v.latitude = num(str(f, 'latitude')); v.longitude = num(str(f, 'longitude'));
  if (Number.isNaN(v.latitude) || Number.isNaN(v.longitude)) e.latitude = 'Coordinates must be numbers.';
  else if ((v.latitude === null) !== (v.longitude === null)) e.latitude = 'Give both latitude and longitude, or neither.';
  else if (v.latitude !== null && (v.latitude < 20.5 || v.latitude > 26.7 || v.longitude < 88.0 || v.longitude > 92.8)) e.latitude = 'Coordinates are outside Bangladesh.';
  v.coords_verified = v.latitude !== null && !e.latitude && str(f, 'coords_verified') === '1' ? 1 : 0;

  const yr = str(f, 'established_year');
  v.established_year = yr ? Number(yr) : null;
  if (yr && (!/^\d{4}$/.test(yr) || v.established_year < 1500 || v.established_year > currentYear)) e.established_year = `Year must be between 1500 and ${currentYear}.`;

  v.management_type = str(f, 'management_type') || null;
  if (v.management_type && !MGMT.includes(v.management_type)) e.management_type = 'Unknown management type.';

  v.website = str(f, 'website') || null;
  if (v.website) {
    try { const u = new URL(v.website); if (!['http:', 'https:'].includes(u.protocol) || v.website.length > 300) throw 0; }
    catch { e.website = 'Website must be a full http(s) address.'; }
  }
  v.summary = str(f, 'summary') || null;
  if (v.summary && v.summary.length > 3000) e.summary = 'Summary is too long (max 3000).';
  return { errors: e, values: v };
}

export function validateSource(f) {
  const e = {}; const v = {
    source_name: str(f, 'source_name'), source_url: str(f, 'source_url') || null,
    accessed_on: str(f, 'accessed_on'), field_name: str(f, 'field_name') || null, note: str(f, 'note') || null,
  };
  if (!v.source_name || v.source_name.length > 200) e.source_name = 'Source name is required.';
  if (v.source_url) { try { if (!['http:', 'https:'].includes(new URL(v.source_url).protocol)) throw 0; } catch { e.source_url = 'Source link must be a full http(s) address.'; } }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.accessed_on) || Number.isNaN(Date.parse(v.accessed_on))) e.accessed_on = 'Use the date format YYYY-MM-DD.';
  if (v.note && v.note.length > 500) e.note = 'Note is too long (max 500).';
  return { errors: e, values: v };
}
