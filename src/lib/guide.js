// مساعد أصالة للزوار في الموقع العام: يجاوب الأسئلة، ويستقبل طلبات انضمام التجار.
// يحتاج ANTHROPIC_API_KEY. بدونه تشتغل الردود الجاهزة في الواجهة بس.
import Anthropic from '@anthropic-ai/sdk';
import { assistantEnabled } from './assistant.js';
import { fail } from './util.js';

const MODEL = 'claude-opus-5-5';

const SYSTEM = `أنت "مساعد أصالة" في الموقع العام لمنصة "أصالة المنتجات الأصلية" في السعودية. تكلم بلهجة خليجية بسيطة ومهذبة، وباختصار (2 إلى 5 أسطر). الزوار نوعين: عملاء يتأكدون من منتجات، وأصحاب علامات تجارية يبون يحمون منتجاتهم.

عن المنصة:
- نصدر علامات NFC تنلصق على المنتج. كل علامة لها رابط موقّع رقمياً ما ينسخ ولا يتخمّن.
- العميل يقرّب جواله من العلامة بدون أي تطبيق (أغلب الجوالات تقرأ NFC مباشرة)، وتفتح صفحة التحقق في المتصفح: "منتج أصلي" أو تحذير.
- الفحص قبل الشراء حر وما يأثر. لما العميل يشتري يضغط «نعم، اشتريته · سجّله باسمي» (رقمه اختياري) وتنسجل العلامة باسمه، والمسابقة والنقاط والكاش باك تسجّلها تلقائياً. بعدها أي جوال ثاني يشوف «قد يكون مقلّداً أو مسجّلاً لشخص آخر» مع اسم مخفي ومدينة وتاريخ. العلامة تنقفل لو مسحتها جوالات مختلفة أكثر من الحد اللي يحدده التاجر، وصاحبها ما تنقفل عليه أبداً. شرائح 424 DNA تولّد رابط جديد مع كل لمسة، فالرابط المنسوخ يطلع «المس الشريحة نفسها».
- لو طلعت للعميل رسالة إن العلامة غير مسجلة أو موقوفة أو انفحصت من جهاز آخر: لا يستخدم المنتج، ويبلّغ من نفس الصفحة، والبلاغ يوصل للتاجر.
- النقاط والكاش باك: لو التاجر مفعّلها، العميل يكتب رقم جواله بعد التحقق وينضاف له الرصيد. لما يكمل الحد يضغط "استبدل" وياخذ كود من 8 حروف يوريه للكاشير.
- المسابقات: بعض التجار يشغّلون مسابقة، مشاركة وحدة لكل علامة، والسحب فرصة وحدة لكل رقم.
- "وين ألقى الأصلي؟": صفحة كل علامة تجارية في الموقع فيها نقاط البيع المعتمدة حسب المدينة.
- للتاجر: لوحة تحكم فيها مخزون العلامات وتنبيه قبل ما تخلص، المبيعات التقديرية والمدن، بؤر التقليد، إيقاف أي علامة، المسابقة والسحب، النقاط والكاش باك، تقييمات العملاء، تقرير شهري، نقاط البيع المعتمدة، ومساعد ذكي يقرأ أرقامه.
- التفعيل: نجهّز حساب التاجر ولوحته في نفس اليوم، ونصدر العلامات بعدد منتجاته ويلصقها في المصنع أو المستودع.
- الأسعار: تختلف حسب الكمية. لا تعطي أي سعر، وقل إن فريق أصالة يتواصل معه بعرض مناسب.

طلب الانضمام لأصحاب العلامات التجارية:
- لو الزائر يبي ينضم أو يبي عرض سعر أو يبي أحد يتواصل معه، اجمع منه: اسمه، اسم علامته التجارية، رقم جواله السعودي، ونوع المنتج وكم منتج يبيع شهرياً (هذول اختياريين).
- اسأل سؤال أو سؤالين في كل رسالة، مو كلها مرة وحدة.
- لما يكتمل الاسم والعلامة والجوال، اعرض عليه ملخص قصير واطلب تأكيده. بعد ما يأكد، استدعِ الأداة submit_join_request مرة وحدة.
- لو الأداة رجعت خطأ (مثل رقم غير صحيح)، اطلب منه يصححه.

قواعد:
- لا تخترع معلومات أو أرقام أو أسماء تجار. لو ما تعرف، قل إن فريق أصالة يقدر يساعده بعد ما يترك بياناته.
- ما تقدر تتحقق من منتج بنفسك. التحقق يكون بمسح العلامة.
- لا تطلب أي معلومات حساسة غير اللي فوق (لا كلمات مرور ولا بطاقات).
- خلك في مواضيع أصالة وحماية المنتجات. لو سأل عن شي بعيد، رجّعه بلطف.`;

const TOOLS = [
  {
    name: 'submit_join_request',
    description: 'يرسل طلب انضمام صاحب علامة تجارية لفريق أصالة. استخدمها بس بعد ما يأكد الزائر بياناته.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'اسم الشخص' },
        brand: { type: 'string', description: 'اسم العلامة التجارية' },
        phone: { type: 'string', description: 'رقم الجوال السعودي كما كتبه، مثل 0551234567' },
        product: { type: 'string', description: 'نوع المنتج، اختياري' },
        qty: { type: 'string', description: 'كم منتج يبيع شهرياً، اختياري' },
      },
      required: ['name', 'brand', 'phone'],
    },
  },
];

function cleanHistory(messages) {
  if (!Array.isArray(messages)) fail(400, 'أرسل رسالتك');
  const out = messages
    .slice(-12)
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, 1000) }));
  while (out.length && out[0].role !== 'user') out.shift();
  if (!out.length || out[out.length - 1].role !== 'user') fail(400, 'أرسل رسالتك');
  return out;
}

// submitJoin يحفظ الطلب ويرمي خطأ لو البيانات غلط
export async function guide(env, history, submitJoin) {
  if (!assistantEnabled(env)) fail(503, 'المساعد غير متاح حالياً', 'assistant_disabled');
  const messages = cleanHistory(history);
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  let joined = false;
  for (let turn = 0; turn < 3; turn++) {
    let res;
    try {
      res = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 1500,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'low' },
        system: SYSTEM,
        tools: TOOLS,
        messages,
      });
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) fail(429, 'المساعد مشغول، جرّب بعد دقيقة');
      if (e instanceof Anthropic.AuthenticationError) fail(503, 'المساعد غير متاح حالياً', 'assistant_disabled');
      if (e instanceof Anthropic.APIError) fail(502, 'تعذر الوصول للمساعد، حاول مرة ثانية');
      throw e;
    }
    if (res.stop_reason === 'refusal') return { answer: 'ما أقدر أساعد في هذا. اسألني عن أصالة أو عن حماية منتجك.', joined };
    const calls = res.content.filter((b) => b.type === 'tool_use');
    if (res.stop_reason !== 'tool_use' || !calls.length) {
      const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
      return { answer: text || 'ما فهمت عليك، ممكن توضح أكثر؟', joined };
    }
    messages.push({ role: 'assistant', content: res.content });
    const results = [];
    for (const c of calls) {
      let content, isError = false;
      if (c.name !== 'submit_join_request') { content = 'أداة غير معروفة'; isError = true; }
      else if (joined) content = 'الطلب انرسل من قبل في هذي المحادثة.';
      else {
        try {
          await submitJoin(c.input || {});
          joined = true;
          content = 'تم إرسال الطلب لفريق أصالة. بلّغ الزائر إن الفريق بيتواصل معه قريب.';
        } catch (e) {
          if (e?.status === 429) content = 'فيه طلبات كثيرة من نفس الجهاز. اطلب منه يحاول بعد ساعة.';
          else content = 'ما انرسل الطلب: ' + (e?.message || 'بيانات غير صحيحة');
          isError = true;
        }
      }
      results.push({ type: 'tool_result', tool_use_id: c.id, content, is_error: isError });
    }
    messages.push({ role: 'user', content: results });
  }
  return { answer: joined ? 'وصلنا طلبك، وفريق أصالة بيتواصل معك قريب.' : 'صار خطأ بسيط، جرّب تكتب رسالتك مرة ثانية.', joined };
}
