// صفحة التحقق بالإنجليزي: ترجمة النصوص الثابتة في الصفحة، ودالة tx للنصوص اللي يكتبها الكود.
// اللغة تنحفظ في الجهاز، والافتراضي إنجليزي لو المتصفح ما فيه عربي أصلاً.
const saved = (() => { try { return localStorage.getItem('asalah_lang'); } catch { return null; } })();
const langs = navigator.languages || [navigator.language || 'ar'];
export const lang = saved === 'en' || saved === 'ar' ? saved : langs.some((l) => String(l).toLowerCase().startsWith('ar')) ? 'ar' : 'en';
export const EN = lang === 'en';
export const tx = (ar, en) => (EN ? en : ar);

const STATIC = {
  'أصالة': 'Asalah',
  'جاري التحقق من المنتج': 'Verifying your product',
  'قراءة العلامة': 'Reading the tag',
  'التحقق من التوقيع الرقمي': 'Checking the digital signature',
  'مطابقة سجل المنتج': 'Matching the product record',
  'منتج أصلي': 'Original product',
  'رقم العلامة': 'Tag number',
  'الدفعة': 'Batch',
  'المنتج': 'Product',
  'الفحوصات': 'Checks',
  'ينتهي': 'Expires',
  'انتبه: المنتج أصلي لكن تاريخه منتهي': 'Note: the product is original but it has expired',
  'هذي علامة تجريبية': 'This is a test tag',
  'شارك: اشتريت أصلي': 'Share: I bought original',
  'زيارة المتجر': 'Visit store',
  'اطلبه مرة ثانية 🛍️': 'Order it again 🛍️',
  'كل المنتجات': 'All products',
  'اجمع نقاطك': 'Collect your points',
  'رقم الجوال': 'Mobile number',
  'أضف للرصيد': 'Add to balance',
  'رصيدك': 'Your balance',
  'استبدل الحين': 'Redeem now',
  'أعط هذا الكود للكاشير': 'Show this code to the cashier',
  'رقم ثاني؟': 'Different number?',
  'كيف المنتج؟': 'How was the product?',
  'تعليقك (اختياري)': 'Your comment (optional)',
  'أرسل التقييم': 'Send rating',
  'شكراً على تقييمك!': 'Thanks for your rating!',
  'شارك في المسابقة': 'Enter the contest',
  'مشاركة وحدة لكل علامة.': 'One entry per tag.',
  'الاسم': 'Name',
  'المدينة': 'City',
  'اسم المحل اللي اشتريت منه': 'Store you bought from',
  'أوافق على': 'I agree to the',
  'شروط المسابقة': 'contest terms',
  'وعلى استخدام بياناتي للسحب فقط': 'and to my data being used for the draw only',
  'سجّل مشاركتي': 'Submit my entry',
  'تم تسجيل مشاركتك': 'Your entry is in',
  'بالتوفيق في السحب!': 'Good luck in the draw!',
  'قد يكون المنتج مقلّداً': 'This product may be counterfeit',
  'تم التحقق من جهاز آخر': 'Verified on another device',
  'ساعدنا نوقف التقليد': 'Help us stop counterfeits',
  'اسم المحل': 'Store name',
  'رقم جوالك (اختياري)': 'Your mobile (optional)',
  'ملاحظة (اختياري)': 'Note (optional)',
  'أرسل البلاغ': 'Send report',
  'تواصل عبر واتساب': 'Contact on WhatsApp',
  'وصلنا بلاغك': 'Report received',
  'شكراً لمساعدتك في وقف التقليد.': 'Thank you for helping stop counterfeits.',
  'محمي بواسطة': 'Protected by',
  'رسالة من صاحب العلامة': 'A message from the brand owner',
  'اضغط واسمع': 'Tap to listen',
  'جواز سفر المنتج': 'Product passport',
  'رحلة منتجك من صاحب العلامة لين وصل لك': 'Your product’s journey from the brand to you',
  'مضمون بضمان أصالة': 'Covered by the Asalah guarantee',
  'صاحب العلامة يضمن إن هذا المنتج أصلي. إذا اكتشفت إنه مقلّد، يرجع لك حقك.': 'The brand guarantees this product is original. If it turns out fake, you get your money back.',
  'اكتشفت إنه مقلّد؟ اطلب الضمان': 'Found it’s fake? Claim the guarantee',
  'رقم الجوال': 'Mobile number',
  'من وين اشتريته': 'Where you bought it',
  'وش لاحظت': 'What did you notice',
  'صورة المنتج (اختياري)': 'Product photo (optional)',
  'أوافق على مشاركة بياناتي مع صاحب العلامة عشان يراجع طلبي': 'I agree to share my details with the brand to review my claim',
  'أرسل طلب الضمان': 'Send guarantee claim',
  '📷 صوّر المنتج (اختياري)': '📷 Photograph the product (optional)',
  'نقارنه بالذكاء الصناعي مع صورة المنتج الأصلي': 'AI compares it with the original product photo',
  '🤖 رأي الذكاء الصناعي في الصورة': '🤖 AI opinion on the photo',
  '🗺️ شوف خريطة التقليد الحية': '🗺️ See the live counterfeit map',
  '📷 تحقق من منتج ثاني بالكاميرا': '📷 Verify another product with the camera',
  'أصالة المنتجات الأصلية': 'Asalah Original Products',
  'التقييم': 'Rating',
  'تحذير': 'Warning',
  'تنبيه': 'Notice',
};

export function translatePage() {
  document.documentElement.lang = lang;
  document.documentElement.dir = EN ? 'ltr' : 'rtl';
  const btn = document.getElementById('lang');
  btn.textContent = EN ? 'ع' : 'EN';
  btn.setAttribute('aria-label', EN ? 'العربية' : 'English');
  if (!EN) return;
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const k = n.nodeValue.trim();
    if (STATIC[k]) n.nodeValue = n.nodeValue.replace(k, STATIC[k]);
  }
  for (const el of document.querySelectorAll('[aria-label],[placeholder]')) {
    for (const a of ['aria-label', 'placeholder']) {
      const v = el.getAttribute(a);
      if (v && STATIC[v]) el.setAttribute(a, STATIC[v]);
    }
  }
  document.title = 'Product verification - Asalah';
}

// تبديل اللغة: نعيد فتح الصفحة بنفس النتيجة بدون فحص جديد
export function onLangToggle(getResult) {
  document.getElementById('lang').addEventListener('click', () => {
    try {
      localStorage.setItem('asalah_lang', EN ? 'ar' : 'en');
      const r = getResult();
      if (r) sessionStorage.setItem('asalah_relang', JSON.stringify(r));
    } catch {}
    location.reload();
  });
}
export function takeCachedResult() {
  try {
    const v = sessionStorage.getItem('asalah_relang');
    sessionStorage.removeItem('asalah_relang');
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}
