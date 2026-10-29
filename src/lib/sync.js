// تحديث أسعار منتجات المتاجر من صفحاتها في سلة، للتجار اللي مفعّلين المزامنة. يشتغل مع فحص كل ساعة.
import { notifyPriceDrop } from './customers.js';
import { importLink } from './store.js';
import { now } from './util.js';

const PER_RUN = 15; // حد الطلبات الخارجية في كل تشغيل
const EVERY = 12 * 3600;

export async function runStoreSync(env) {
  const db = env.DB;
  const t = now();
  const rows = (
    await db
      .prepare(
        `SELECT p.id,p.title,p.buy_url,p.price,p.old_price FROM store_products p JOIN merchants m ON m.id=p.merchant_id
         WHERE m.store_enabled=1 AND m.store_auto_sync=1 AND m.status='active' AND (p.synced_at IS NULL OR p.synced_at<?)
         ORDER BY COALESCE(p.synced_at,0) LIMIT ?`
      )
      .bind(t - EVERY, PER_RUN)
      .all()
  ).results;
  let changed = 0;
  for (const p of rows) {
    try {
      const live = await importLink(p.buy_url);
      const price = live.price ? Math.round(live.price * 100) : null;
      if (price && price !== p.price) {
        // لو السعر نزل، السعر القديم يصير "قبل الخصم"
        const old = price < p.price ? Math.max(p.price, p.old_price || 0) : p.old_price && p.old_price > price ? p.old_price : null;
        await db.prepare('UPDATE store_products SET price=?,old_price=?,synced_at=?,sync_error=NULL,updated_at=? WHERE id=?').bind(price, old, t, t, p.id).run();
        if (p.price != null && price < p.price) await notifyPriceDrop(db, { ...p, price }, p.price);
        changed++;
      } else await db.prepare('UPDATE store_products SET synced_at=?,sync_error=NULL WHERE id=?').bind(t, p.id).run();
    } catch (e) {
      await db.prepare('UPDATE store_products SET synced_at=?,sync_error=? WHERE id=?').bind(t, String(e?.message || 'تعذر التحديث').slice(0, 200), p.id).run();
    }
  }
  return { checked: rows.length, changed };
}
