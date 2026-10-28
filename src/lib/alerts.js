// تنبيهات تلقائية كل ساعة: المخزون قارب يخلص أو خلص، وموجة أكواد مزيّفة.
// كل نوع تنبيه يتكرر مرة كل 24 ساعة كحد أقصى لكل تاجر.
import { stockFor } from './tags.js';
import { now, riyadhDayStart } from './util.js';

const WAVE_THRESHOLD = 20; // أكواد مزيّفة لنفس التاجر في يوم واحد

async function raise(db, merchantId, kind, message) {
  const t = now();
  const recent = await db.prepare('SELECT id FROM alerts WHERE merchant_id=? AND kind=? AND created_at>?').bind(merchantId, kind, t - 86400).first();
  if (recent) return false;
  await db.prepare('INSERT INTO alerts(merchant_id,kind,message,created_at) VALUES(?,?,?,?)').bind(merchantId, kind, message, t).run();
  return true;
}

export async function runAlerts(env) {
  const db = env.DB;
  const merchants = (await db.prepare("SELECT id,name,low_stock_threshold FROM merchants WHERE status='active'").all()).results;
  const today = riyadhDayStart(now());
  const raised = [];
  for (const m of merchants) {
    const s = await stockFor(db, m.id);
    if (s.active > 0 && s.remaining === 0) {
      if (await raise(db, m.id, 'out_of_stock', `خلص مخزون ${m.name}: كل العلامات المفعّلة انمسحت`)) raised.push([m.id, 'out_of_stock']);
    } else if (s.active > 0 && s.remaining <= m.low_stock_threshold) {
      const eta = s.days_left != null ? ` ويخلص خلال ${s.days_left} يوم تقريباً` : '';
      const msg = `مخزون ${m.name} قارب يخلص: باقي ${s.remaining.toLocaleString('en-US')} علامة${eta}`;
      if (await raise(db, m.id, 'low_stock', msg)) raised.push([m.id, 'low_stock']);
    }
    const wave = await db.prepare("SELECT COUNT(*) AS n FROM scans WHERE merchant_id=? AND result='unknown' AND created_at>=?").bind(m.id, today).first();
    if (wave.n >= WAVE_THRESHOLD) {
      if (await raise(db, m.id, 'counterfeit_wave', `موجة تقليد: ${wave.n} مسح لأكواد مزيّفة باسم ${m.name} اليوم`)) raised.push([m.id, 'counterfeit_wave']);
    }
  }
  return raised;
}
