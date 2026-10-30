// متجر تجريبي على /s/demo للتجار: نفس المتجر الخاص والمعرض، ببيانات ثابتة وبدون خادم.
// ?t=perfume|fashion|tech يغيّر نوع المتجر عشان التاجر يشوف الأشكال.

// صورة منتج مرسومة بالمتصفح (خلفية متدرجة + رمز) عشان ما نعتمد على صور حقيقية
function art(emoji, a, b) {
  const c = Object.assign(document.createElement('canvas'), { width: 600, height: 600 });
  const x = c.getContext('2d');
  const g = x.createRadialGradient(300, 230, 20, 300, 300, 460);
  g.addColorStop(0, b);
  g.addColorStop(1, a);
  x.fillStyle = g;
  x.fillRect(0, 0, 600, 600);
  x.fillStyle = 'rgba(0,0,0,.2)';
  x.beginPath();
  x.ellipse(300, 500, 170, 28, 0, 0, Math.PI * 2);
  x.fill();
  x.font = '290px serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(emoji, 300, 290);
  return c.toDataURL('image/jpeg', 0.86);
}

const L = (headline, sub, bullets, faq) => ({ headline, sub, bullets, faq: faq || [{ q: 'كيف أتأكد إن المنتج أصلي؟', a: 'على كل منتج علامة أصالة. المسها بجوالك أو صوّر الـQR وتطلع لك النتيجة خلال ثانية.' }, { q: 'كم ياخذ التوصيل؟', a: 'من 2 إلى 5 أيام لكل مدن المملكة.' }], cta: 'اطلب الحين', urgency: 'الكمية محدودة لهالدفعة' });

const STORES = {
  perfume: {
    config: {
      name: 'دار العود', tagline: 'عطور وبخور فاخرة بأصالة مضمونة', announcement: '🎁 تغليف هدايا مجاني لكل طلب', theme: 'perfume', font: 'amiri', card: 'glass',
      colors: { primary: '#7a5a2b', accent: '#d9b45a', bg: '#15110c' },
      slides: [{ title: 'دار العود', sub: 'روائح فاخرة تدوم، وكل زجاجة أصلية بعلامة أصالة', cta: 'اكتشف العطور' }, { title: 'دهن العود والبخور', sub: 'مختارة بعناية من أجود المصادر', cta: 'تسوّق البخور' }],
      sections: [{ title: 'العطور', category: 'perfume' }, { title: 'البخور والعود', category: 'home' }, { title: 'الهدايا', category: 'accessories' }],
      coupon: { code: 'OPEN10', percent: 10, note: 'خصم الافتتاح' },
      about: 'دار العود متجر متخصص في العطور والبخور الفاخرة. كل منتج عندنا أصلي وموثّق بعلامة أصالة.',
    },
    products: [
      ['عطر الليل الملكي 100 مل', 'perfume', 420, 520, '🧴', '#2a1a10', '#8a6a3a', L('عطر يدوم معك من الصبح لليل', 'مزيج العود والعنبر بلمسة فرنسية، ثباته عالي وفوحانه هادي.', ['🌙 ثبات أكثر من 12 ساعة', '🪵 عود كمبودي طبيعي', '🎁 علبة هدية فاخرة', '✅ أصلي بعلامة أصالة'])],
      ['دهن عود كمبودي 3 مل', 'perfume', 290, 350, '🫙', '#1d140c', '#6b4a22', L('دهن العود اللي يعرفه أهل الذوق', 'قطرة وحدة تكفي يومك كامل.', ['🪵 كمبودي معتّق', '💧 قطرة تكفي', '✅ موثّق ضد التقليد'])],
      ['مسك الطهارة الأبيض', 'perfume', 85, null, '🤍', '#2b2622', '#cfc3b0', null],
      ['عطر الورد الطائفي', 'perfume', 240, null, '🌹', '#2a0f17', '#b0485e', L('ورد الطائف في زجاجة', 'رائحة ورد طبيعية ناعمة تناسب كل الأوقات.', ['🌹 ورد طائفي أصلي', '✨ ناعم ومنعش', '✅ أصلي بعلامة أصالة'])],
      ['بخور معمول فاخر', 'home', 120, 150, '🪔', '#1f150b', '#9a6a2e', null],
      ['عود كلمنتان قطع', 'home', 360, null, '🪵', '#1a120a', '#7a5530', null],
      ['مبخرة ذهبية كهربائية', 'accessories', 199, 249, '🏺', '#1c1508', '#c9a24a', null],
      ['طقم هدية العيد', 'accessories', 550, 690, '🎁', '#22140c', '#d9b45a', L('أجمل هدية للي تحبهم', 'عطر + دهن عود + بخور في علبة فاخرة.', ['🎁 3 منتجات أصلية', '🎀 تغليف جاهز للإهداء', '🚚 توصيل سريع'])],
    ],
  },
  fashion: {
    config: {
      name: 'أناقة', tagline: 'عبايات وأزياء نسائية بتفاصيل راقية', announcement: '🚚 شحن مجاني فوق 300 ريال', theme: 'fashion', font: 'tajawal', card: 'soft',
      colors: { primary: '#b0688a', accent: '#f5c2d6', bg: '#2b1d27' },
      slides: [{ title: 'تشكيلة الموسم', sub: 'قصّات راقية وخامات مريحة', cta: 'شوفي التشكيلة' }, { title: 'أناقة', sub: 'أصلية وموثّقة من أصالة', cta: 'تسوّقي الحين' }],
      sections: [{ title: 'العبايات', category: 'fashion' }, { title: 'الشنط والإكسسوارات', category: 'accessories' }],
      coupon: { code: 'ANAQA15', percent: 15, note: 'خصم الافتتاح' },
      about: 'أناقة تقدّم لك عبايات وأزياء بتصاميم أنيقة وخامات مختارة.',
    },
    products: [
      ['عباية كريب سوداء مطرزة', 'fashion', 380, 450, '🥻', '#1d141b', '#6d4a63', L('عباية تلفت الأنظار بهدوء', 'كريب ياباني فاخر مع تطريز يدوي ناعم.', ['🧵 تطريز يدوي', '🌬️ خامة خفيفة ومريحة', '📏 كل المقاسات'])],
      ['عباية بشت ملكي', 'fashion', 520, null, '👘', '#24161f', '#a06a86', null],
      ['جلابية صيفية', 'fashion', 210, 260, '👗', '#2b1d27', '#d68aaa', null],
      ['طرحة شيفون', 'fashion', 65, null, '🧣', '#2a1f27', '#e2b4c8', null],
      ['شنطة يد جلد', 'accessories', 340, 420, '👜', '#22171d', '#b07a5a', L('شنطة تكمّل إطلالتك', 'جلد طبيعي وتصميم عملي يكفي أغراضك.', ['👜 جلد طبيعي', '✨ تفاصيل ذهبية', '✅ أصلية بعلامة أصالة'])],
      ['نظارة شمسية', 'accessories', 190, null, '🕶️', '#1f1a1d', '#8a7a85', null],
    ],
  },
  tech: {
    config: {
      name: 'شاحن برو', tagline: 'إكسسوارات أصلية لجوالك بضمان أصالة', announcement: '⚡ كل الشواحن أصلية ومضمونة', theme: 'tech', font: 'almarai', card: 'sharp',
      colors: { primary: '#2563eb', accent: '#38bdf8', bg: '#0b1220' },
      slides: [{ title: 'شحن أسرع، حماية أقوى', sub: 'إكسسوارات أصلية بدون تقليد', cta: 'تسوّق الحين' }],
      sections: [{ title: 'الشواحن والكيابل', category: 'electronics' }, { title: 'الساعات والسماعات', category: 'watches' }],
      coupon: { code: 'PRO10', percent: 10, note: 'خصم' },
      about: 'ودّع الشواحن المقلّدة اللي تضر جوالك. كل منتج عندنا موثّق بعلامة أصالة.',
    },
    products: [
      ['شاحن سريع 65 واط', 'electronics', 149, 199, '🔌', '#0b1220', '#1e40af', L('اشحن جوالك في نص ساعة', 'شاحن أصلي يحمي بطاريتك من الحرارة.', ['⚡ 65 واط', '🛡️ حماية من الحرارة', '✅ أصلي بعلامة أصالة'])],
      ['كيبل تايب سي مضفّر', 'electronics', 49, null, '🔋', '#0d1424', '#2563eb', null],
      ['باور بانك 20000', 'electronics', 189, 230, '🪫', '#0b1220', '#0ea5e9', null],
      ['سماعات لاسلكية', 'watches', 299, 360, '🎧', '#0f172a', '#6366f1', null],
      ['ساعة ذكية رياضية', 'watches', 449, null, '⌚', '#0b1220', '#22d3ee', L('ساعتك تتابع صحتك', 'نبض، نوم، خطوات، وبطارية تكفي أسبوع.', ['❤️ قياس النبض', '🔋 أسبوع بطارية', '💧 ضد الماء'])],
      ['كفر حماية مغناطيسي', 'electronics', 79, 99, '📱', '#111827', '#3b82f6', null],
    ],
  },
};

export function demoData(kind) {
  const s = STORES[kind] || STORES.perfume;
  return {
    merchant: { name: s.config.name, slug: 'demo', logo_url: null },
    config: { view: '3d', checkout: 'whatsapp', has_whatsapp: true, shipping: '🚚 شحن لكل مدن المملكة خلال 2 إلى 5 أيام', payment: 'نأكد طلبك على واتساب ونرسل لك طريقة الدفع', ...s.config },
    products: s.products.map(([title, category, price, old, emoji, a, b, landing], i) => ({
      id: i + 1, title, category, price, old_price: old, image_url: art(emoji, a, b), landing, buy_url: null,
      description: landing?.sub || 'منتج أصلي موثّق بعلامة أصالة.', rating: i % 3 === 0 ? { avg: 4.8, n: 37 + i * 5 } : null,
    })),
    demo: true,
  };
}
export const DEMO_KINDS = [['perfume', '🌸 عطور'], ['fashion', '👗 أزياء'], ['tech', '📱 تقنية']];
