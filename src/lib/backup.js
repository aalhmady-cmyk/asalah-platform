// نسخة احتياطية أسبوعية من قاعدة البيانات كاملة في R2، والمدير يحمّلها من اللوحة الأم.
// الملف JSON مضغوط (gzip): { version, created_at, tables: { اسم_الجدول: [صفوف] } }
import { now } from './util.js';

const SKIP = new Set(['sessions', 'login_tickets', 'rate_limits', 'customer_sessions', '_cf_KV', 'd1_migrations', 'schema_migrations']);
const KEEP = 8; // آخر 8 نسخ (شهرين)
const EVERY = 7 * 86400;
const PREFIX = 'backups/';

export async function makeBackup(env) {
  const db = env.DB;
  const names = (await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()).results.map((r) => r.name).filter((n) => !SKIP.has(n) && !n.startsWith('_'));
  const tables = {};
  let rows = 0;
  for (const name of names) {
    const out = [];
    // على دفعات عشان الجداول الكبيرة ما تتجاوز حد الرد
    for (let last = -1; ;) {
      const { results } = await db.prepare(`SELECT rowid AS __r, * FROM "${name}" WHERE rowid>? ORDER BY rowid LIMIT 2000`).bind(last).all();
      for (const r of results) { last = r.__r; delete r.__r; out.push(r); }
      if (results.length < 2000) break;
    }
    tables[name] = out;
    rows += out.length;
  }
  const t = now();
  const body = new Blob([JSON.stringify({ version: 1, created_at: t, tables })]).stream().pipeThrough(new CompressionStream('gzip'));
  const data = await new Response(body).arrayBuffer();
  const key = `${PREFIX}asalah-${new Date(t * 1000).toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json.gz`;
  await env.MEDIA.put(key, data, { httpMetadata: { contentType: 'application/gzip' }, customMetadata: { rows: String(rows), tables: String(names.length) } });
  await db.prepare("INSERT INTO settings(key,value) VALUES('backup_last',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(String(t)).run();
  // نحذف الأقدم ونخلي آخر KEEP
  const list = await listBackups(env);
  for (const old of list.slice(KEEP)) await env.MEDIA.delete(PREFIX + old.name);
  return { name: key.slice(PREFIX.length), size: data.byteLength, rows };
}

export async function listBackups(env) {
  const { objects } = await env.MEDIA.list({ prefix: PREFIX, include: ['customMetadata'] });
  return objects
    .map((o) => ({ name: o.key.slice(PREFIX.length), size: o.size, at: Math.floor(o.uploaded.getTime() / 1000), rows: Number(o.customMetadata?.rows) || null }))
    .sort((a, b) => b.at - a.at);
}

export async function getBackup(env, name) {
  if (!/^asalah-[0-9-]+\.json\.gz$/.test(name)) return null;
  return env.MEDIA.get(PREFIX + name);
}

// من الكرون كل ساعة: إذا مر أسبوع على آخر نسخة نسوي وحدة
export async function runBackup(env) {
  if (!env.MEDIA) return null;
  const last = Number((await env.DB.prepare("SELECT value FROM settings WHERE key='backup_last'").first())?.value) || 0;
  if (now() - last < EVERY) return null;
  return makeBackup(env);
}
