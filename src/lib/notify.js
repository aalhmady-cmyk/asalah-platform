// إشعارات واتساب للتاجر عبر WhatsApp Cloud API (من Meta).
// تحتاج الأسرار: WHATSAPP_TOKEN و WHATSAPP_PHONE_ID، وقالب رسالة معتمد في Meta فيه متغير واحد {{1}}.
// اسم القالب WHATSAPP_TEMPLATE (الافتراضي asalah_alert) ولغته WHATSAPP_LANG (الافتراضي ar).
// بدون الأسرار ما ينرسل شي، والتنبيهات تبقى في اللوحة مثل قبل.
import { now } from './util.js';

const KINDS = { low_stock: '📦', out_of_stock: '🚨', counterfeit_wave: '⚠️' };

export const whatsappEnabled = (env) => Boolean(env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_ID);

export async function sendWhatsApp(env, to, message) {
  const res = await fetch(`https://graph.facebook.com/v21.0/${env.WHATSAPP_PHONE_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.WHATSAPP_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: env.WHATSAPP_TEMPLATE || 'asalah_alert',
        language: { code: env.WHATSAPP_LANG || 'ar' },
        components: [{ type: 'body', parameters: [{ type: 'text', text: message.slice(0, 900) }] }],
      },
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d?.error?.message || 'WhatsApp ' + res.status);
  }
}

// يسجل الرسالة ويرسلها، ويرجع حالتها
export async function deliver(env, merchantId, to, message) {
  const db = env.DB;
  const row = await db
    .prepare("INSERT INTO notifications(merchant_id,channel,to_addr,message,status,created_at) VALUES(?,'whatsapp',?,?,'pending',?) RETURNING id")
    .bind(merchantId, to, message, now())
    .first();
  try {
    await sendWhatsApp(env, to, message);
    await db.prepare("UPDATE notifications SET status='sent',sent_at=? WHERE id=?").bind(now(), row.id).run();
    return 'sent';
  } catch (e) {
    await db.prepare("UPDATE notifications SET status='failed',error=? WHERE id=?").bind(String(e.message).slice(0, 300), row.id).run();
    return 'failed';
  }
}

async function pointer(db, key, fallback) {
  await db.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)').bind(key, String(fallback)).run();
  return Number((await db.prepare('SELECT value FROM settings WHERE key=?').bind(key).first()).value);
}
const setPointer = (db, key, v) => db.prepare('UPDATE settings SET value=? WHERE key=?').bind(String(v), key).run();

// التنبيهات الجديدة وبلاغات التقليد من آخر تشغيل
export async function notifyMerchants(env) {
  const db = env.DB;
  const top = async (sql) => (await db.prepare(sql).first())?.n ?? 0;
  const aPtr = await pointer(db, 'wa_alert_ptr', await top('SELECT MAX(id) AS n FROM alerts'));
  const rPtr = await pointer(db, 'wa_report_ptr', await top('SELECT MAX(id) AS n FROM reports'));
  const alerts = (await db.prepare(`SELECT a.id,a.kind,a.message,m.id AS mid,m.alert_phone,m.notify_whatsapp FROM alerts a JOIN merchants m ON m.id=a.merchant_id WHERE a.id>? ORDER BY a.id LIMIT 20`).bind(aPtr).all()).results;
  const reports = (await db.prepare(`SELECT r.id,r.city,r.point_of_sale,m.id AS mid,m.name,m.alert_phone,m.notify_whatsapp FROM reports r JOIN merchants m ON m.id=r.merchant_id WHERE r.id>? ORDER BY r.id LIMIT 20`).bind(rPtr).all()).results;
  const ok = (x) => whatsappEnabled(env) && x.notify_whatsapp && /^9665\d{8}$/.test(x.alert_phone || '');
  let sent = 0;
  for (const a of alerts) if (KINDS[a.kind] && ok(a) && (await deliver(env, a.mid, a.alert_phone, `${KINDS[a.kind]} ${a.message}`)) === 'sent') sent++;
  for (const r of reports) if (ok(r) && (await deliver(env, r.mid, r.alert_phone, `🚩 بلاغ تقليد جديد على ${r.name}: ${r.city} · ${r.point_of_sale}. التفاصيل في لوحة أصالة.`)) === 'sent') sent++;
  if (alerts.length) await setPointer(db, 'wa_alert_ptr', alerts[alerts.length - 1].id);
  if (reports.length) await setPointer(db, 'wa_report_ptr', reports[reports.length - 1].id);
  return sent;
}
