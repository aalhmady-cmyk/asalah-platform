// مسارات النمو: صفحة التجار، طلبات التجار الجدد، صحة المنصة، خطوات البداية
import { addLead, listLeads, merchantsPage, onboarding, platformHealth, saveSiteConfig, siteConfig, updateLead } from '../lib/growth.js';
import { audit, fail, json, readJson, saPhone, str } from '../lib/util.js';

export async function handlePublicGrowth(req, env, path) {
  if (path === '/api/public/merchants-page' && req.method === 'GET') return json({ ok: true, ...(await merchantsPage(env.DB)) }, 200, { 'Cache-Control': 'public, max-age=300' });
  return null;
}

export async function handleMerchantGrowth(req, env, path, mid) {
  if (path === '/api/m/onboarding' && req.method === 'GET') return json({ ok: true, ...(await onboarding(env.DB, mid)) });
  return null;
}

export async function handleAdminGrowth(req, env, path, user) {
  const db = env.DB, m = req.method;
  if (path === '/api/admin/health' && m === 'GET') return json({ ok: true, ...(await platformHealth(db)) });
  if (path === '/api/admin/site' && m === 'GET') return json({ ok: true, ...(await siteConfig(db)) });
  if (path === '/api/admin/site' && m === 'PUT') {
    const c = await saveSiteConfig(db, await readJson(req));
    await audit(db, user, 'site_config', { plans: c.plans.length, story: Boolean(c.story) });
    return json({ ok: true, ...c });
  }
  if (path === '/api/admin/leads' && m === 'GET') return json({ ok: true, ...(await listLeads(db)) });
  if (path === '/api/admin/leads' && m === 'POST') {
    const b = await readJson(req);
    const f = {
      name: str(b.name, 'الاسم', { min: 2, max: 100 }),
      brand: str(b.brand, 'العلامة التجارية', { min: 2, max: 100 }),
      phone: b.phone ? saPhone(b.phone) : null,
      product: str(b.product, 'نوع المنتج', { max: 150, optional: true }),
      qty: str(b.qty, 'الكمية', { max: 40, optional: true }),
    };
    const row = await addLead(db, f, 'manual');
    return json({ ok: true, id: row.id }, 201);
  }
  const lm = path.match(/^\/api\/admin\/leads\/(\d+)$/);
  if (lm && m === 'PATCH') {
    const lead = await updateLead(db, Number(lm[1]), await readJson(req));
    await audit(db, user, 'lead_update', { id: lead.id, status: lead.status });
    return json({ ok: true, lead });
  }
  if (lm && m === 'DELETE') {
    const r = await db.prepare('DELETE FROM leads WHERE id=?').bind(Number(lm[1])).run();
    if (!r.meta.changes) fail(404, 'ما لقينا الطلب');
    return json({ ok: true });
  }
  return null;
}
