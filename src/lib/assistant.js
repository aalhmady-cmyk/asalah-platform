// المساعد الذكي للتاجر: يقرأ أرقام التاجر ويطلع له ملاحظات، ويجاوب أسئلته.
// الملاحظات تشتغل دائماً بدون أي اشتراك. الأسئلة الحرة تحتاج ANTHROPIC_API_KEY في أسرار Worker.
import Anthropic from '@anthropic-ai/sdk';
import { entriesWithFlags, hotspots, monthlyReport } from './insights.js';
import { overviewFor } from './ops.js';
import { fail, now } from './util.js';

const MODEL = 'claude-opus-5-5';

export async function merchantContext(db, merchantId) {
  const month = new Date((now() + 10800) * 1000).toISOString().slice(0, 7);
  const [merchant, ov, spots, report, entries, lastDraw] = await Promise.all([
    db.prepare('SELECT name,max_checks,low_stock_threshold,contest_enabled,contest_title,contest_ends_at,store_url,public_listed,loyalty_enabled,loyalty_mode,loyalty_per_tag,loyalty_min_redeem,loyalty_reward FROM merchants WHERE id=?').bind(merchantId).first(),
    overviewFor(db, merchantId),
    hotspots(db, merchantId, 30),
    monthlyReport(db, merchantId, month),
    entriesWithFlags(db, merchantId, { limit: 2000 }),
    db.prepare('SELECT title,winners_count,pool_size,created_at FROM draws WHERE merchant_id=? ORDER BY id DESC LIMIT 1').bind(merchantId).first(),
  ]);
  const [sellers, members, rating] = await Promise.all([
    db.prepare('SELECT COUNT(*) AS n FROM sellers WHERE merchant_id=?').bind(merchantId).first(),
    db.prepare('SELECT COUNT(*) AS members,COALESCE(SUM(balance),0) AS outstanding FROM loyalty_members WHERE merchant_id=?').bind(merchantId).first(),
    db.prepare('SELECT COUNT(*) AS n,ROUND(AVG(stars),2) AS avg FROM ratings WHERE merchant_id=?').bind(merchantId).first(),
  ]);
  return {
    today: new Date((now() + 10800) * 1000).toISOString().slice(0, 10),
    merchant,
    stock: ov.stock,
    scans: { today: ov.scans_today, last_7_days: ov.scans_7d, original_ratio_7d: ov.original_ratio, fake_today: ov.unknown_today, reports_7d: ov.reports_7d, by_city_7d: ov.cities_7d, daily_14d: ov.daily },
    this_month: { month, scans: report.scans, original: report.original, sold: report.sold, entries: report.entries, reports: report.reports, top_batches: report.batches, top_cities: report.cities },
    counterfeit_hotspots_30d: spots.slice(0, 8),
    contest: { entries: entries.length, suspicious_entries: entries.filter((e) => e.flags.length).length, last_draw: lastDraw },
    authorized_sellers: sellers.n,
    // الكاش باك بالهللة
    loyalty: { enabled: Boolean(merchant.loyalty_enabled), mode: merchant.loyalty_mode, per_tag: merchant.loyalty_per_tag, min_redeem: merchant.loyalty_min_redeem, reward: merchant.loyalty_reward, ...members },
    ratings: rating,
  };
}

// ملاحظات جاهزة من الأرقام (بدون ذكاء اصطناعي)
export function tips(c) {
  const out = [];
  const s = c.stock;
  if (s.active === 0) out.push({ level: 'warn', text: 'ما عندك علامات مفعّلة للحين. أول ما توصلك الدفعة، فعّلها من إدارة أصالة.' });
  else if (s.days_left != null && s.days_left <= 30) out.push({ level: 'warn', text: `علاماتك تخلص خلال ${s.days_left} يوم تقريباً بمعدل البيع الحالي. اطلب دفعة جديدة الحين، لأن الطباعة والشحن تاخذ وقت.` });
  else if (s.remaining <= c.merchant.low_stock_threshold) out.push({ level: 'warn', text: `باقي ${s.remaining.toLocaleString('en-US')} علامة بس، وهذا أقل من حد التنبيه حقك.` });
  if (c.scans.original_ratio_7d != null && c.scans.original_ratio_7d < 90 && c.scans.last_7_days >= 20)
    out.push({ level: 'err', text: `${(100 - c.scans.original_ratio_7d).toFixed(1)}% من المسحات هالأسبوع ما كانت أصلية. هذي نسبة عالية وتستاهل متابعة.` });
  const top = c.counterfeit_hotspots_30d[0];
  if (top && top.suspicious >= 5)
    out.push({ level: 'err', text: `أكثر مدينة فيها تقليد هالشهر: ${top.city} (${top.suspicious} حالة)${top.places.length ? `، وأكثر المحلات المذكورة في البلاغات: ${top.places.slice(0, 3).join('، ')}` : ''}.` });
  if (c.scans.reports_7d > 0) out.push({ level: 'info', text: `وصلك ${c.scans.reports_7d} بلاغ تقليد خلال 7 أيام. راجعها من تبويب البلاغات.` });
  if (!c.merchant.contest_enabled && c.this_month.sold >= 50)
    out.push({ level: 'info', text: 'المسابقة موقوفة. تشغيلها يخلي العميل يمسح العلامة ويسجّل، وهذا يعطيك بيانات عملائك ومدنهم.' });
  if (c.contest.suspicious_entries > 0) out.push({ level: 'warn', text: `فيه ${c.contest.suspicious_entries} مشاركة مشبوهة في المسابقة. استبعدها قبل السحب.` });
  if (c.merchant.contest_enabled && c.merchant.contest_ends_at && c.merchant.contest_ends_at < now() + 7 * 86400 && c.merchant.contest_ends_at > now())
    out.push({ level: 'info', text: 'المسابقة تنتهي خلال أقل من أسبوع. جهّز السحب، واعلن الفائزين.' });
  if (!c.loyalty.enabled && c.this_month.sold >= 30)
    out.push({ level: 'info', text: 'جرّب تشغيل النقاط أو الكاش باك: العميل يجمع رصيد مع كل منتج أصلي، ويرجع يشتري منك عشان يستبدل.' });
  if (c.ratings.n >= 5 && c.ratings.avg < 3.5) out.push({ level: 'warn', text: `متوسط تقييم منتجاتك ${c.ratings.avg} من 5. شوف تعليقات العملاء في تبويب النقاط.` });
  if (!c.authorized_sellers) out.push({ level: 'info', text: 'أضف نقاط البيع المعتمدة، عشان العميل يعرف وين يلقى منتجك الأصلي في الموقع العام.' });
  const cities = c.scans.by_city_7d.filter((x) => x.city !== 'غير معروف');
  if (cities.length) out.push({ level: 'good', text: `أكثر مدينة يمسح منها عملاؤك هالأسبوع: ${cities[0].city} (${cities[0].n} مسح).` });
  if (!out.length) out.push({ level: 'good', text: 'كل شي تمام: المخزون كافي وما فيه تقليد ملحوظ.' });
  return out;
}

export const assistantEnabled = (env) => typeof env.ANTHROPIC_API_KEY === 'string' && env.ANTHROPIC_API_KEY.length > 20;

function cleanHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .slice(-8)
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.slice(0, 3000) }));
}

export async function ask(env, ctx, question, history) {
  if (!assistantEnabled(env)) fail(503, 'الأسئلة الحرة تحتاج تفعيل من إدارة أصالة', 'assistant_disabled');
  const q = String(question ?? '').trim();
  if (q.length < 2) fail(400, 'اكتب سؤالك');
  if (q.length > 1000) fail(400, 'السؤال طويل، اختصره');
  const messages = [...cleanHistory(history), { role: 'user', content: q }];
  while (messages.length && messages[0].role !== 'user') messages.shift();

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  let res;
  try {
    res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 2000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: [
        {
          type: 'text',
          text: `أنت "مساعد أصالة"، مساعد ذكي لتاجر يستخدم منصة "أصالة المنتجات الأصلية". المنصة تبيع علامات NFC تنلصق على المنتجات، والعميل يمسحها بجواله ويتأكد إن المنتج أصلي، ويقدر يشارك في مسابقة التاجر.
مهمتك: تساعد التاجر يفهم أرقامه (المخزون، المسحات، المبيعات التقديرية، التقليد، المسابقة) ويقرر خطوته الجاية.
- تكلم بلهجة خليجية بسيطة ومهذبة، وباختصار (3 إلى 6 أسطر غالباً). استخدم نقاط إذا فيه أكثر من فكرة.
- اعتمد فقط على البيانات تحت. لا تخترع أرقام. إذا المعلومة مو موجودة، قل ما عندي هالرقم، واقترح من وين يلقاه في لوحته.
- الكاش باك في البيانات بالهللة (100 = ريال)، اعرضه بالريال.
- "انمسحت" أو "sold" تعني علامات انمسحت أول مرة، وهي تقدير للمبيعات مو رقم مبيعات فعلي.
- لا تعطي نصائح قانونية مؤكدة. للمسابقات ذكّره بترخيص وزارة التجارة، وللبيانات بنظام حماية البيانات الشخصية.
- أقسام لوحة التاجر: الرئيسية، العلامات (الدفعات وإيقاف العلامات وصور المنتجات)، النقاط والكاش باك (الإعدادات وتأكيد أكواد الاستبدال والتقييمات)، المسابقة (الإعدادات والمشاركات والسحب)، التقليد (البلاغات وبؤر التقليد)، التقارير (التقرير الشهري)، نقاط البيع، الحساب.`,
        },
        { type: 'text', text: 'بيانات التاجر الحالية (JSON):\n' + JSON.stringify(ctx) },
      ],
      messages,
    });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) fail(429, 'المساعد مشغول، جرّب بعد دقيقة');
    if (e instanceof Anthropic.AuthenticationError) fail(503, 'مفتاح المساعد غير صحيح، تواصل مع إدارة أصالة');
    if (e instanceof Anthropic.APIError) fail(502, 'تعذر الوصول للمساعد، حاول مرة ثانية');
    throw e;
  }
  if (res.stop_reason === 'refusal') return 'ما أقدر أساعد في هذا الطلب. اسألني عن أرقامك أو مخزونك أو مسابقتك.';
  const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
  return text || 'ما قدرت أطلع جواب، جرّب تعيد صياغة السؤال.';
}
