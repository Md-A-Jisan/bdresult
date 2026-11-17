// Console routes for institutions. Every POST: same-origin check, role check, validation, audit log.
import { CONSOLE_HEADERS } from './console.mjs';
import { sameOrigin, audit } from './auth.mjs';
import { validateInstitution, validateSource } from './validate.mjs';
import * as inst from './institutions.mjs';
import * as ui from './institution-views.mjs';

const html = (body, status = 200) => new Response(body, { status, headers: CONSOLE_HEADERS });
const see = (loc) => new Response(null, { status: 303, headers: { location: loc, 'cache-control': 'no-store' } });
const MSG = { created: 'Institution created.', updated: 'Facts updated.', reverted: 'Facts updated. Because the profile was verified, it is back to “pending” and unpublished until re-verified.', source: 'Source added.', verified: 'Verification status updated.', published: 'Publish state updated.' };

export async function institutionRoutes(request, env, user, url) {
  const db = env.DB; const m = request.method;
  const parts = url.pathname.replace(/\/+$/, '').split('/'); // ['', 'console', 'institutions', id?, action?]
  if (parts[2] !== 'institutions') return null;
  const id = parts[3] && parts[3] !== 'new' ? Number(parts[3]) : null;
  const action = parts[4] || '';
  if (parts[3] && parts[3] !== 'new' && !Number.isInteger(id)) return html(ui.notFoundPage(user), 404);

  if (m === 'POST' && !sameOrigin(request)) return html(ui.notAllowedPage(user), 403);
  const need = (ok) => (ok ? null : html(ui.notAllowedPage(user), 403));

  if (m === 'GET' && !parts[3]) {
    const f = Object.fromEntries(['q', 'type', 'district', 'status', 'publish', 'page'].map((k) => [k, url.searchParams.get(k) || '']));
    return html(ui.listPage(user, await inst.listInstitutions(db, f), await inst.lookups(db), f));
  }
  if (parts[3] === 'new' && m === 'GET') return need(ui.canEdit(user)) || html(ui.formPage(user, await inst.lookups(db), {}, {}, { action: '/console/institutions', title: 'Add institution' }));
  if (!parts[3] && m === 'POST') {
    const denied = need(ui.canEdit(user)); if (denied) return denied;
    return saveForm(request, env, user, null);
  }
  if (!id) return null;
  const row = await inst.getInstitution(db, id);
  if (!row) return html(ui.notFoundPage(user), 404);

  const detail = async (extra = {}, status = 200) => html(ui.detailPage(user, await inst.getInstitution(db, id), null, await inst.listSources(db, id), await inst.listVerificationLog(db, id), extra), status);

  if (m === 'GET' && !action) return detail({ msg: MSG[url.searchParams.get('msg')] || '' });
  if (m === 'GET' && action === 'edit') return need(ui.canEdit(user)) || html(ui.formPage(user, await inst.lookups(db), row, {}, { action: `/console/institutions/${id}/edit`, title: `Edit: ${row.name_en}` }));
  if (m !== 'POST') return null;

  if (action === 'edit') return need(ui.canEdit(user)) || saveForm(request, env, user, row);
  const f = await request.formData();
  if (action === 'sources') {
    const denied = need(ui.canSource(user)); if (denied) return denied;
    const { errors, values } = validateSource(f);
    if (Object.keys(errors).length) return detail({ srcErrors: errors, srcValues: values }, 400);
    await inst.addSource(db, id, values);
    await audit(env, user.id, 'add_source', 'institution', String(id), values);
    return see(`/console/institutions/${id}?msg=source`);
  }
  if (action === 'verify') {
    const denied = need(ui.canVerify(user)); if (denied) return denied;
    const r = await inst.setVerification(db, id, String(f.get('status') || ''), String(f.get('note') || '').slice(0, 500), user.id);
    if (r.error) return detail({ error: r.error }, 400);
    await audit(env, user.id, 'verification', 'institution', String(id), r);
    return see(`/console/institutions/${id}?msg=verified`);
  }
  if (action === 'publish') {
    const denied = need(ui.canPublish(user)); if (denied) return denied;
    const r = await inst.setPublish(db, id, String(f.get('action') || ''));
    if (r.error) return detail({ error: r.error }, 400);
    await audit(env, user.id, 'publish_state', 'institution', String(id), r);
    return see(`/console/institutions/${id}?msg=published`);
  }
  return null;
}

async function saveForm(request, env, user, existing) {
  const db = env.DB; const f = await request.formData();
  const { errors, values } = await validateInstitution(f, db);
  const lk = await inst.lookups(db);
  const action = existing ? `/console/institutions/${existing.id}/edit` : '/console/institutions';
  const title = existing ? `Edit: ${existing.name_en}` : 'Add institution';
  if (!Object.keys(errors).length) {
    const dupes = await inst.possibleDuplicates(db, values, existing ? existing.id : 0);
    const hard = dupes.some((d) => d.reason === 'same_eiin');
    const soft = dupes.length && !hard && f.get('confirm_duplicate') !== '1';
    if (hard || soft) return html(ui.formPage(user, lk, { ...values, ...Object.fromEntries(f) , coords_verified: values.coords_verified }, {}, { action, title, dupes }), 409);
    if (!existing) {
      const id = await inst.createInstitution(db, values);
      await audit(env, user.id, 'create', 'institution', String(id), values);
      return see(`/console/institutions/${id}?msg=created`);
    }
    const { before, reverted } = await inst.updateInstitution(db, existing.id, values, user.id);
    await audit(env, user.id, 'update', 'institution', String(existing.id), { before: pick(before, values), after: values });
    return see(`/console/institutions/${existing.id}?msg=${reverted ? 'reverted' : 'updated'}`);
  }
  return html(ui.formPage(user, lk, Object.fromEntries(f), errors, { action, title }), 400);
}
const pick = (o, ref) => Object.fromEntries(Object.keys(ref).map((k) => [k, o[k] ?? null]));
