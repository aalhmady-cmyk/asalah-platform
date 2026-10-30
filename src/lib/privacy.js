// حماية البيانات الشخصية: تنظيف يومي للبيانات اللي انتهى غرضها، وحذف بيانات عميل برقم جواله عند الطلب
import { now } from './util.js';

const DAY = 86400;
const CART_DAYS = 30; // السلة المتروكة (فيها اسم وجوال) تنحذف بعد 30 يوم
const GONE = 'محذوف';

export async function runRetention(env) {
  const db = env.DB;
  const last = Number((await db.prepare("SELECT value FROM settings WHERE key='retention_last'").first())?.value) || 0;
  const t = now();
  if (t - last < DAY) return null;
  const [carts] = await db.batch([
    db.prepare("DELETE FROM orders WHERE status='cart' AND updated_at<?").bind(t - CART_DAYS * DAY),
    db.prepare('DELETE FROM sessions WHERE expires_at<?').bind(t),
    db.prepare('DELETE FROM customer_sessions WHERE expires_at<?').bind(t),
    db.prepare('DELETE FROM login_tickets WHERE expires_at<?').bind(t),
    db.prepare('DELETE FROM rate_limits WHERE expires_at<?').bind(t),
    db.prepare("INSERT INTO settings(key,value) VALUES('retention_last',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(String(t)),
  ]);
  return { carts: carts.meta?.changes || 0 };
}

// يمسح الاسم والجوال من كل مكان. الأرقام والإحصائيات تبقى بدون ما تعرّف بالشخص
export async function erasePhone(db, phone) {
  const res = await db.batch([
    db.prepare('UPDATE entries SET customer_name=?,phone=? WHERE phone=?').bind(GONE, GONE, phone),
    db.prepare('UPDATE draw_winners SET phone=? WHERE phone=?').bind(GONE, phone),
    db.prepare("UPDATE loyalty_members SET phone='deleted-'||id,name=NULL WHERE phone=?").bind(phone),
    db.prepare('UPDATE orders SET name=NULL,phone=NULL,note=NULL WHERE phone=?').bind(phone),
    db.prepare('UPDATE reports SET phone=NULL WHERE phone=?').bind(phone),
    db.prepare('UPDATE guarantee_claims SET name=?,phone=? WHERE phone=?').bind(GONE, GONE, phone),
    db.prepare('UPDATE tags SET owner_phone=NULL WHERE owner_phone=?').bind(phone),
    db.prepare('UPDATE leads SET phone=NULL WHERE phone=?').bind(phone),
    db.prepare('DELETE FROM excluded_phones WHERE phone=?').bind(phone),
  ]);
  return res.reduce((n, r) => n + (r.meta?.changes || 0), 0);
}
