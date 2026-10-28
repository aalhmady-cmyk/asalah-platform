(() => {
'use strict';

/* ---------- icons ---------- */
const ICONS = {
  play:'<polygon points="6 3 20 12 6 21 6 3"/>',
  x:'<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  menu:'<line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="12" y2="12"/><line x1="10" x2="20" y1="18" y2="18"/>',
  bag:'<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  cam:'<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  up:'<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
  back:'<path d="m9 18 6-6-6-6"/>',
  spark:'<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>',
  bot:'<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4"/><circle cx="9" cy="14" r="1"/><circle cx="15" cy="14" r="1"/>',
  box:'<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  search:'<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  heart:'<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  plus:'<path d="M5 12h14"/><path d="M12 5v14"/>',
  trash:'<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  chart:'<path d="M3 3v18h18"/><path d="M7 16v-5"/><path d="M12 16V8"/><path d="M17 16v-3"/>',
  refresh:'<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M8 16H3v5"/>'
};
const icon = (n, s=22) => `<svg aria-hidden="true" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${ICONS[n]}</svg>`;
const LOGO = s => `<svg aria-hidden="true" width="${s}" height="${s}" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#0F2A21"/><path d="M24 26v-3a8 8 0 0 1 16 0v3" fill="none" stroke="#D9B45A" stroke-width="3.5" stroke-linecap="round"/><path d="M15 26h34l-3 24a4 4 0 0 1-4 3.5H22a4 4 0 0 1-4-3.5Z" fill="#D9B45A"/><path d="M25 39l5 5 9-10" fill="none" stroke="#0F2A21" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/* ---------- demo catalog ---------- */
const CITIES = ['المدينة المنورة','الرياض','جدة'];
const MERCHANTS = {
  m1:{name:'متجر الأناقة', fee:[20,18,22], days:[2,2,3], freeOver:200, ret:'إرجاع خلال 7 أيام', floor:0.10},
  m2:{name:'بيت الأزياء', fee:[0,0,0], days:[4,3,4], freeOver:0, ret:'إرجاع مجاني خلال 14 يوم', floor:0},
  m3:{name:'ستايل سبورت', fee:[25,20,25], days:[3,2,3], freeOver:null, ret:'إرجاع خلال 7 أيام', floor:0.15},
  m4:{name:'خطوة للأحذية', fee:[25,25,20], days:[4,3,2], freeOver:300, ret:'استبدال فقط خلال 7 أيام', floor:0.08}
};
const CATS = {
  tshirt:{label:'تيشيرتات', one:'تيشيرت', words:['تيشيرت','تيشرت','تي شيرت','تشيرت','بولو','تيشيرتات']},
  shirt:{label:'قمصان', one:'قميص', words:['قميص','قمصان']},
  shoes:{label:'أحذية', one:'حذاء', words:['حذاء','احذيه','جزمه','جزم','كوتشي','سنيكرز','جوتي']},
  abaya:{label:'عبايات', one:'عباية', words:['عبايه','عبايات','عباية']},
  bag:{label:'شنط', one:'شنطة', words:['شنطه','شنط','حقيبه','حقائب']},
  watch:{label:'ساعات', one:'ساعة', words:['ساعه','ساعات']},
  cap:{label:'كابات', one:'كاب', words:['كاب','قبعه','كابات']}
};
const COLORS = {
  black:{label:'أسود', hex:'#1F2422', words:['اسود','سوداء','سودا','سود']},
  white:{label:'أبيض', hex:'#F4F5F3', words:['ابيض','بيضاء','بيضا','بيض']},
  navy:{label:'كحلي', hex:'#1F2F4F', words:['كحلي']},
  beige:{label:'بيج', hex:'#D8C3A0', words:['بيج']},
  gray:{label:'رمادي', hex:'#8B9290', words:['رمادي','رماديه','رصاصي']},
  blue:{label:'أزرق', hex:'#2F6FB3', words:['ازرق','زرقاء','زرقا']}
};
const P = (id,name,mid,cat,color,price,material,sizes,desc) => ({id,name,mid,cat,color,price,material,sizes,desc});
const PRODUCTS = [
  P('p1','تيشيرت قطني أسود','m1','tshirt','black',70,'قطن 100٪',{S:2,M:5,L:4,XL:0},'قصة عادية وياقة دائرية، للاستخدام اليومي.'),
  P('p2','تيشيرت أوفرسايز أسود','m2','tshirt','black',79,'قطن مخلوط',{S:3,M:3,L:2,XL:5},'قصة واسعة وأكتاف نازلة.'),
  P('p3','تيشيرت رياضي أسود','m3','tshirt','black',65,'بوليستر سريع الجفاف',{S:0,M:6,L:6,XL:3,XXL:2},'خفيف ويطرد العرق، مناسب للنادي.'),
  P('p4','تيشيرت قطني أبيض','m1','tshirt','white',70,'قطن 100٪',{S:4,M:4,L:1,XL:2},'قصة عادية وياقة دائرية.'),
  P('p5','تيشيرت بولو كحلي','m2','tshirt','navy',89,'قطن بيكيه',{M:2,L:3,XL:1},'ياقة بأزرار، شكل أنيق للدوام.'),
  P('p6','قميص كتان بيج','m1','shirt','beige',145,'كتان',{M:2,L:2,XL:1},'خامة خفيفة للصيف.'),
  P('p7','قميص رسمي أبيض','m2','shirt','white',120,'قطن بوبلين',{S:1,M:3,L:3,XL:2},'قصة مستقيمة للمناسبات والدوام.'),
  P('p8','حذاء رياضي أبيض','m4','shoes','white',200,'جلد صناعي',{'40':1,'41':3,'42':2,'43':2,'44':0},'نعل مسطح مريح للمشي.'),
  P('p9','حذاء جري أسود','m3','shoes','black',260,'شبك قابل للتهوية',{'41':2,'42':3,'43':1,'44':2},'نعل مرن لامتصاص الصدمات.'),
  P('p10','حذاء كاجوال أبيض','m4','shoes','white',140,'قماش كانفس',{'40':2,'41':2,'42':4,'43':3},'خفيف ويناسب الطلعات.'),
  P('p11','عباية سوداء كلاسيك','m2','abaya','black',220,'كريب',{'52':2,'54':3,'56':2,'58':1},'قصة بشت واسعة بأكمام عريضة.'),
  P('p12','عباية رمادية مطرزة','m1','abaya','gray',310,'نيدا',{'54':1,'56':2,'58':1},'تطريز يدوي على الأكمام.'),
  P('p13','شنطة يد بيج','m1','bag','beige',180,'جلد صناعي',{'مقاس واحد':4},'مقاس متوسط بجيب داخلي بسحاب.'),
  P('p14','ساعة رياضية سوداء','m3','watch','black',240,'سيليكون',{'مقاس واحد':5},'مقاومة للماء، تعرض الخطوات والنبض.'),
  P('p15','كاب رياضي أزرق','m3','cap','blue',45,'قطن',{'مقاس واحد':8},'قابل للتعديل من الخلف.')
];
const byId = id => PRODUCTS.find(p => p.id === id);
const NEW = ['p2','p5','p9','p12','p13','p15'];
// sample reviews for the demo only
const REVIEWS = {
  p1:[[5,'القطن ممتاز والمقاس مضبوط'],[4,'حلو بس يحتاج كوي بعد الغسيل'],[5,'وصل بسرعة وتغليفه نظيف'],[4,'المقاس مضبوط واللون ثابت']],
  p2:[[5,'الأوفرسايز واسع زي ما أبي'],[3,'المقاس كبير شوي، خذ أصغر بمقاس'],[4,'خامته خفيفة وحلوة للصيف']],
  p3:[[5,'ممتاز للنادي وما يحبس العرق'],[4,'المقاس صغير شوي، خذ أكبر بمقاس'],[5,'خفيف جدًا']],
  p8:[[5,'مريح للمشي طول اليوم'],[4,'المقاس مضبوط بس النعل قاسي أول أسبوع'],[5,'شكله أحلى من الصور']],
  p9:[[5,'نعل مريح جدًا للجري'],[4,'المقاس صغير شوي'],[4,'التوصيل تأخر يوم بس المنتج ممتاز']],
  p11:[[5,'القماش ثقيل وما يشف'],[5,'القصة واسعة ومريحة'],[4,'الطول مضبوط بس الأكمام طويلة شوي']],
  p12:[[5,'التطريز فخم'],[4,'اللون أفتح من الصور شوي'],[5,'وصلت بتغليف هدية']],
  p13:[[4,'حجمها مناسب للدوام'],[5,'الجلد ممتاز بالنسبة لسعرها'],[3,'السحاب الداخلي ضعيف شوي']],
  p14:[[4,'البطارية تقعد ثلاث أيام'],[5,'خفيفة ومريحة'],[3,'الشاشة تحت الشمس مو واضحة']]
};
const WEEKDAYS = ['الاحد','الاثنين','الثلاثاء','الاربعاء','الخميس','الجمعه','السبت'];
const GOES_WITH = {tshirt:['shoes','cap','watch'], shirt:['shoes','watch'], shoes:['tshirt','cap'], abaya:['bag'], bag:['abaya'], watch:['shirt','tshirt'], cap:['tshirt','shoes']};
const stock = p => Object.values(p.sizes).reduce((a,b)=>a+b,0);

/* ---------- art ---------- */
const SHAPES = {
  tshirt:'<path d="M35 18 20 26 12 42l12 6 4-6v42h44V42l4 6 12-6-8-16-15-8c-3 7-9 10-15 10s-12-3-15-10Z"/>',
  shirt:'<path d="M35 16 18 24 10 66l12 2 6-24v42h44V44l6 24 12-2-8-42-17-8-15 12Z"/><path d="M42 18l8 12 8-12M50 30v54" fill="none"/>',
  shoes:'<path d="M10 64c0-10 4-22 12-26 6 6 16 8 26 6l10 8c10 4 26 4 32 10 3 3 2 8-2 9H14c-3 0-4-3-4-7Z"/><path d="M10 72h82" fill="none" stroke-width="4"/>',
  abaya:'<path d="M38 12h24l6 18 14 58H18l14-58Z"/><path d="M32 30 16 60M68 30l16 30" fill="none" stroke-width="5"/>',
  bag:'<path d="M36 42c0-18 28-18 28 0" fill="none" stroke-width="5"/><path d="M20 42h60l-5 44H25Z"/>',
  watch:'<path d="M40 8h20v22H40zM40 70h20v22H40z"/><circle cx="50" cy="50" r="22"/><path d="M50 40v10l7 5" fill="none"/>',
  cap:'<path d="M16 62c0-22 16-34 34-34s34 12 34 34Z"/><path d="M50 62h42c0 9-24 9-42 4Z"/>'
};
function art(p){
  const c = COLORS[p.color].hex, light = ['white','beige'].includes(p.color);
  const stroke = light ? '#B9C2BE' : 'rgba(255,255,255,.35)';
  return `<svg viewBox="0 0 100 100" aria-hidden="true" fill="${c}" stroke="${stroke}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">${SHAPES[p.cat]}</svg>`;
}

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
function h(tag, attrs={}, ...kids){
  const el = document.createElement(tag);
  for (const [k,v] of Object.entries(attrs||{})){
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
}
const sar = n => `${n.toLocaleString('ar-SA-u-nu-latn')} ر.س`;
const norm = s => String(s).replace(/[ً-ْـ]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي')
  .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).toLowerCase();
const dayName = n => { const d = new Date(); d.setDate(d.getDate()+n); return d.toLocaleDateString('ar-SA-u-ca-gregory',{weekday:'long'}); };
const ci = () => CITIES.indexOf(S.city);
function shipFor(mid, subtotal){
  const m = MERCHANTS[mid], i = ci();
  const base = m.fee[i];
  const free = base === 0 || (m.freeOver != null && m.freeOver > 0 && subtotal >= m.freeOver);
  return {fee: free ? 0 : base, days: m.days[i], free};
}

const unitPrice = p => { const d = S.deals && S.deals[p.id]; return d && d.until > Date.now() ? d.price : p.price; };
function priceEl(p, cls='pp', extra){
  const u = unitPrice(p);
  return h('div', {class:cls, style:extra || null}, sar(u), u < p.price ? h('span', {class:'old'}, sar(p.price)) : null);
}
const sizeGroup = c => c === 'tshirt' || c === 'shirt' ? 'top' : c === 'shoes' ? 'shoe' : c === 'abaya' ? 'abaya' : null;
const usualSize = p => { const g = sizeGroup(p.cat), z = g && S.mySize[g]; return z && (p.sizes[z] || 0) > 0 ? z : null; };
const rememberSize = (p, z) => { const g = sizeGroup(p.cat); if (g) S.mySize[g] = z; };
const round5 = n => Math.round(n / 5) * 5;

/* ---------- state ---------- */
const KEY = 'asalah-stores-demo-v1';
const S = { city:'المدينة المنورة', cart:[], orders:[], msgs:[], last:[], lastF:null, stats:{bot:0, ai:0}, view:'chat', payKey:null, favs:[], taste:{}, seen:{}, budget:200, sort:'new', gcat:'all', deals:{}, mySize:{}, alerts:[], gift:{on:false, name:''}, haggle:{}, occ:null, fam:{on:false, who:'أنت', people:['أنت']} };
try { const saved = JSON.parse(localStorage.getItem(KEY) || 'null'); if (saved) Object.assign(S, saved, {view:'chat', payKey:null}); S.favs ||= []; S.taste ||= {}; S.seen ||= {}; S.deals ||= {}; S.mySize ||= {}; S.alerts ||= []; S.gift ||= {on:false, name:''}; S.haggle ||= {}; S.fam ||= {on:false, who:'أنت', people:['أنت']}; } catch(e) {}
function save(){ try { localStorage.setItem(KEY, JSON.stringify({city:S.city, cart:S.cart, orders:S.orders, msgs:S.msgs.slice(-40), last:S.last, lastF:S.lastF, stats:S.stats, favs:S.favs, taste:S.taste, seen:S.seen, budget:S.budget, sort:S.sort, gcat:S.gcat, deals:S.deals, mySize:S.mySize, alerts:S.alerts, gift:S.gift, haggle:S.haggle, occ:S.occ, fam:S.fam})); } catch(e) {} }

// الذكاء الاصطناعي يمر عبر خادم أصالة. الخادم يبني الطلب بنفسه، والمتصفح يرسل البيانات بس.
let sample = null, imgOK = false;
const AI_URL = '/api/public/shop-ai';
async function shopAI(body){
  const r = await fetch(AI_URL, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(d.message || 'ai_failed'); if (r.status === 503) e.code = 'sampling_disabled'; throw e; }
  return d.result;
}
fetch(AI_URL).then(r => r.json()).then(d => { if (d.chat) { sample = true; imgOK = true; } }).catch(() => {});
// الصورة تتصغّر في الجوال قبل الإرسال
function toJpeg(file, max = 1024){
  return new Promise((resolve, reject) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.82).split(',')[1]);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad_image')); };
    img.src = url;
  });
}

/* ---------- parsing (the bot) ---------- */
function findKey(map, text){
  for (const [k,v] of Object.entries(map)) for (const w of v.words) { const nw = norm(w); if (new RegExp(`(^|\\s|ال|بال|و)${nw}`).test(text)) return k; }
  return null;
}
function parse(raw){
  const t = norm(raw).replace(/\s+/g,' ').trim();
  const f = {cats:[], color:null, max:null, min:null, city:null, size:null, intent:null};
  if (/وين طلب|طلباتي|طلبي|تتبع|شحنتي/.test(t)) f.intent = 'orders';
  else if (/^(سلتي|السله|سله)$/.test(t) || /افتح السله/.test(t)) f.intent = 'cart';
  else if (/قارن|الفرق بين|مقارنه/.test(t)) f.intent = 'compare';
  else if (/ارجاع|استرجاع|استبدال|مشكله/.test(t)) f.intent = 'help';
  else if (/^(السلام|هلا|مرحبا|اهلا|هاي)/.test(t)) f.intent = 'hello';
  else if (/(^|\s|ال|لل|ب)(مناسبه|عرس|زواج|حفله|عزيمه|ملكه|تخرج|عيد)(\s|$)/.test(t)) f.intent = 'occasion';
  else if (/ارخص/.test(t)) f.intent = 'cheaper';
  else if (/شحن مجاني/.test(t)) f.intent = 'free';
  else if (/غير المدينه|غير العنوان/.test(t)) f.intent = 'city';
  else if (/اكمل التسوق|^كمل/.test(t)) f.intent = 'more';
  for (const k of Object.keys(CATS)) if (findKey({[k]:CATS[k]}, t)) f.cats.push(k);
  if (/هديه/.test(t) && !f.cats.length){
    if (/(ام|امي|والدتي|زوجتي|اختي|بنتي)/.test(t)) f.cats = ['abaya','bag'];
    else if (/(ابوي|ابي|والدي|زوجي|اخوي|ولدي)/.test(t)) f.cats = ['watch','shirt'];
    else f.cats = ['watch','bag','cap'];
  }
  f.color = findKey(COLORS, t);
  let m;
  if ((m = t.match(/بين\s*(\d+)\s*(?:و|الى|-)\s*(\d+)/))) { f.min = +m[1]; f.max = +m[2]; }
  else if ((m = t.match(/(?:اقل من|تحت|ما يتعدي|ما يزيد عن|حد اقصي|بحدود|حدود|في حدود|ميزانيتي|الى)\s*(\d+)/))) f.max = +m[1];
  else if ((m = t.match(/(?:اكثر من|فوق)\s*(\d+)/))) f.min = +m[1];
  if (/مدينه/.test(t)) f.city = CITIES[0]; else if (/رياض/.test(t)) f.city = CITIES[1]; else if (/(^|\s|ل|في)جده/.test(t)) f.city = CITIES[2];
  if ((m = t.match(/مقاس\s*([a-z]{1,3}|\d{2})/))) f.size = m[1].toUpperCase();
  else if ((m = t.match(/(?:^|\s)(xxl|xl|xs|s|m|l)(?:\s|$)/))) f.size = m[1].toUpperCase();
  return f;
}
const meaningful = f => !!(f.cats.length || f.color || f.max || f.min || f.size);

/* ---------- search (always over real catalog data) ---------- */
function search(f){
  const fit = (p, useColor, usePrice) =>
    (!f.cats.length || f.cats.includes(p.cat)) &&
    (!useColor || !f.color || p.color === f.color) &&
    (!usePrice || ((f.max == null || p.price <= f.max) && (f.min == null || p.price >= f.min))) &&
    (!f.size || (p.sizes[f.size] || 0) > 0) && stock(p) > 0;
  let list = PRODUCTS.filter(p => fit(p,true,true)), relaxed = null;
  if (!list.length && f.color) { list = PRODUCTS.filter(p => fit(p,false,true)); if (list.length) relaxed = 'color'; }
  if (!list.length && (f.max || f.min)) { list = PRODUCTS.filter(p => fit(p,true,false)); if (list.length) relaxed = 'price'; }
  list.sort((a,b) => a.price - b.price);
  return {list: list.slice(0,6), relaxed};
}
function filterChips(f){
  const out = [];
  f.cats.forEach(c => out.push({k:'cat:'+c, t:CATS[c].label}));
  if (f.color) out.push({k:'color', t:'اللون: '+COLORS[f.color].label});
  if (f.min != null && f.max != null) out.push({k:'price', t:`بين ${f.min} و${f.max}`});
  else if (f.max != null) out.push({k:'price', t:`أقل من ${f.max}`});
  else if (f.min != null) out.push({k:'price', t:`أكثر من ${f.min}`});
  if (f.size) out.push({k:'size', t:'المقاس: '+f.size});
  out.push({k:'city', t:'التوصيل: '+S.city, fixed:true});
  return out;
}

/* ---------- conversation ---------- */
function push(m){ S.msgs.push(m); save(); renderMain(); }
function botSay(text, extra={}){ S.stats[extra.ai ? 'ai' : 'bot']++; push({role:'bot', text, ...extra}); }

function runSearch(f, opts={}){
  if (f.city) S.city = f.city;
  const {list, relaxed} = search(f);
  S.last = list.map(p => p.id); S.lastF = f;
  let text;
  const what = f.cats.length ? f.cats.map(c => CATS[c].label).join(' و') : 'منتجات';
  if (!list.length) text = `ما لقيت ${what} بهالمواصفات عندنا حاليًا. جرّب تغيّر اللون أو الميزانية.`;
  else if (relaxed === 'color') text = `ما عندنا ${what} باللون ${COLORS[f.color].label} حاليًا. هذي أقرب الخيارات بألوان ثانية:`;
  else if (relaxed === 'price') text = `ما لقيت ضمن الميزانية. هذي الأقرب لها، وأسعارها أعلى شوي:`;
  else text = opts.lead || `لقيت لك ${list.length} ${list.length === 1 ? 'خيار' : 'خيارات'}، كلها توصل ${S.city}:`;
  botSay(text, {ai: !!opts.ai, kind:'results', f, ids:S.last});
}

async function handle(raw){
  const text = raw.trim(); if (!text) return;
  const lastB = [...S.msgs].reverse().find(x => x.role === 'bot');
  push({role:'me', text});
  if (S.occ && /(رجالي|نسائي|رجال|نساء|بناتي|حريم)/.test(norm(text)) && !parse(text).cats.length) return buildOutfit(/(نسائي|نساء|بناتي|حريم)/.test(norm(text)) ? 'w' : 'm');
  const num = norm(text).match(/\d+/);
  if (lastB && (lastB.kind === 'haggle' || lastB.kind === 'hagglefinal') && num && !parse(text).cats.length) return offer(lastB.pid, +num[0]);
  const f = parse(text);
  if (f.intent === 'orders') return showOrdersInChat();
  if (f.intent === 'cart') { botSay('هذي سلتك:', {kind:'cartlink'}); return; }
  if (f.intent === 'compare') return compare();
  if (f.intent === 'help') { botSay('تقدر تطلب الإرجاع من صفحة الطلب نفسها، أو أحولك لموظف خدمة العملاء مع ملخص طلبك.', {kind:'quick', qs:['طلباتي','كلّم موظف']}); return; }
  if (f.intent === 'hello' && !f.cats.length && !f.color) { botSay('هلا والله! وش تدوّر عليه اليوم؟', {kind:'quick', qs:['تيشيرت أسود أقل من 80','حذاء رياضي مقاس 42','هدية لأمي بحدود 250']}); return; }
  if (f.intent === 'cheaper') {
    if (!S.last.length) { botSay('وش المنتج اللي تبغى أرخص خياراته؟'); return; }
    const ids = [...S.last].sort((a,b) => { const A = byId(a), B = byId(b); return (A.price + shipFor(A.mid, A.price).fee) - (B.price + shipFor(B.mid, B.price).fee); });
    S.last = ids; botSay('رتبتها لك من الأرخص، شامل الشحن:', {kind:'results', f:S.lastF, ids}); return;
  }
  if (f.intent === 'free') {
    const base = S.lastF ? search(S.lastF).list : PRODUCTS.filter(p => stock(p) > 0);
    const ids = base.filter(p => shipFor(p.mid, p.price).free).map(p => p.id);
    if (!ids.length) { botSay('ولا خيار من هذي شحنه مجاني إلى ' + S.city + '.'); return; }
    S.last = ids; botSay('هذي اللي شحنها مجاني:', {kind:'results', f:S.lastF, ids}); return;
  }
  if (f.intent === 'city') { botSay('وين نوصل طلبك؟', {kind:'quick', qs:CITIES}); return; }
  if (f.intent === 'occasion') {
    const tt = norm(text);
    let days = 7, when = 'خلال أسبوع';
    if (/بعد بكره/.test(tt)) { days = 2; when = 'بعد بكرة'; }
    else if (/بكره/.test(tt)) { days = 1; when = 'بكرة'; }
    else if (/اليوم|الليله/.test(tt)) { days = 0; when = 'اليوم'; }
    else { const i = WEEKDAYS.findIndex(w => new RegExp(`(^|\\s)(يوم\\s)?(ال)?${w.replace(/^ال/, '')}(\\s|$)`).test(tt)); if (i >= 0) { days = (i - new Date().getDay() + 7) % 7 || 7; when = 'يوم ' + dayName(days); } }
    S.occ = {budget: f.max || null, days, when}; save();
    if (days === 0) { botSay('اليوم ما نلحق نوصل لك شي، أقرب توصيل عندنا بكرة. تبغى أجهز لك لبسة توصل بكرة؟', {kind:'quick', qs:['لبسة رجالية','لبسة نسائية']}); S.occ.days = 1; S.occ.when = 'بكرة'; save(); return; }
    botSay(`حلو! المناسبة ${when}${f.max ? ` والميزانية ${sar(f.max)}` : ''}. أجهز لك لبسة كاملة لمين؟`, {kind:'quick', qs:['لبسة رجالية','لبسة نسائية']});
    return;
  }
  if (f.intent === 'more') { botSay('وش تبغى بعد؟', {kind:'quick', qs:['تيشيرتات','أحذية','عبايات','شنط','ساعات']}); return; }
  if (/كلم موظف|موظف/.test(norm(text))) { botSay('تم تحويل محادثتك لموظف خدمة العملاء مع ملخص لها. بيرد عليك خلال ساعات العمل. (في النسخة التجريبية ما فيه موظف فعلي)'); return; }
  if (meaningful(f)) {
    if (!f.cats.length && !f.color && !f.max && !f.min && f.size && S.last.length) { return chooseSizeFor(S.last[0], f.size); }
    return runSearch(f);
  }
  if (f.city) {
    S.city = f.city; save();
    if (S.lastF) return runSearch({...S.lastF, city:f.city}, {lead:`تمام، صار التوصيل إلى ${f.city}. هذي الأسعار والمواعيد الجديدة:`});
    botSay(`تمام، صار التوصيل إلى ${f.city}. وش تبغى تشتري؟`); return;
  }
  return aiUnderstand(text);
}

async function aiUnderstand(text){
  if (!sample) {
    botSay('ما فهمت طلبك بالضبط. اكتب نوع المنتج ولونه وميزانيتك، مثل: «قميص أبيض أقل من 150».', {kind:'quick', qs:['تيشيرتات','أحذية','عبايات','ساعات']});
    return;
  }
  push({role:'bot', kind:'typing', text:''});
  try {
    const r = await shopAI({task:'filters', text:text.slice(0,500)});
    S.msgs = S.msgs.filter(m => m.kind !== 'typing');
    const f = {cats:[], color:null, max:null, min:null, city:null, size:null, intent:null};
    if (Array.isArray(r?.categories)) f.cats = r.categories.filter(c => CATS[c]);
    if (COLORS[r?.color]) f.color = r.color;
    if (Number.isFinite(+r?.maxPrice) && r.maxPrice > 0) f.max = +r.maxPrice;
    if (Number.isFinite(+r?.minPrice) && r.minPrice > 0) f.min = +r.minPrice;
    if (typeof r?.size === 'string' && r.size.length <= 4) f.size = r.size.toUpperCase();
    if (r?.intent === 'orders') { S.stats.ai++; return showOrdersInChat(); }
    if (f.cats.length || f.color || f.max || f.min) return runSearch(f, {ai:true});
    botSay(typeof r?.reply === 'string' && r.reply.length < 200 ? r.reply : 'وش نوع المنتج اللي تدوّر عليه؟', {ai:true, kind:'quick', qs:['تيشيرتات','أحذية','عبايات','شنط']});
  } catch(e) {
    S.msgs = S.msgs.filter(m => m.kind !== 'typing');
    if (e && (e.code === 'not_granted' || e.code === 'sampling_disabled')) sample = null;
    botSay('ما قدرت أفهم طلبك هالمرة. اكتب نوع المنتج ولونه وميزانيتك، مثل: «حذاء أبيض أقل من 200».', {kind:'quick', qs:['تيشيرتات','أحذية','عبايات']});
  }
}

async function photoSearch(file){
  const url = URL.createObjectURL(file);
  push({role:'me', text:'أبغى شي مثل هذا', img:url});
  if (!sample || !imgOK) { botSay('البحث بالصورة يحتاج الذكاء الاصطناعي، وهو غير متاح في هذا العرض. اكتب لي وصف المنتج وأدوّره لك.'); return; }
  push({role:'bot', kind:'typing', text:''});
  try {
    const r = await shopAI({task:'photo', image: await toJpeg(file)});
    S.msgs = S.msgs.filter(m => m.kind !== 'typing');
    const f = {cats: CATS[r?.category] ? [r.category] : [], color: COLORS[r?.color] ? r.color : null, max:null, min:null, size:null};
    if (!f.cats.length) { botSay('ما قدرت أحدد المنتج في الصورة. جرّب صورة أوضح للمنتج لحاله.', {ai:true}); return; }
    const d = typeof r.description === 'string' ? r.description.slice(0,120) : CATS[f.cats[0]].one;
    runSearch(f, {ai:true, lead:`هذا ${d}. هذا أقرب شي عندنا:`});
  } catch(e) {
    S.msgs = S.msgs.filter(m => m.kind !== 'typing');
    botSay('ما قدرت أقرأ الصورة. جرّب صورة ثانية أو اكتب وصف المنتج.');
  }
}

function chooseSizeFor(pid, preset){
  const p = byId(pid);
  const given = preset && (p.sizes[preset] || 0) > 0 ? preset : null;
  const pre = given || usualSize(p);
  botSay(Object.keys(p.sizes).length === 1 ? `${p.name}، كم حبة تبغى؟` : `اختيار ممتاز. وش مقاسك في «${p.name}»؟`, {kind:'pick', pid, size: pre || (Object.keys(p.sizes).length === 1 ? Object.keys(p.sizes)[0] : null), qty:1, auto: !given && !!pre});
}

function compare(){
  const ids = S.last.slice(0,3);
  if (ids.length < 2) { botSay('ابحث عن منتجين أو أكثر أول، وبعدها أقارن لك بينهم.'); return; }
  botSay('هذي مقارنة من بيانات المتاجر مباشرة:', {kind:'compare', ids});
}

function showOrdersInChat(){
  if (!S.orders.length) { botSay('ما عندك طلبات للحين. أول ما تطلب، تقدر تسألني «وين طلبي؟» وأعطيك حالة كل شحنة.'); return; }
  botSay('هذي حالة آخر طلب لك:', {kind:'orders', oid:S.orders[S.orders.length-1].id});
}

/* ---------- occasion outfit (rules only) ---------- */
function outfitCost(ps){
  const by = {};
  ps.forEach(p => (by[p.mid] ||= []).push(p));
  let total = 0;
  for (const [mid, list] of Object.entries(by)) { const sub = list.reduce((a,p) => a + unitPrice(p), 0); total += sub + shipFor(mid, sub).fee; }
  return {total, ships: Object.keys(by).length};
}
function buildOutfit(g){
  const o = S.occ || {budget:null, days:7, when:'خلال أسبوع'};
  const plan = g === 'w' ? ['abaya','bag','shoes'] : ['shirt','shoes','watch'];
  const ok = p => stock(p) > 0 && shipFor(p.mid, p.price).days <= o.days;
  const tryCats = cats => {
    const lists = cats.map(c => PRODUCTS.filter(p => p.cat === c && ok(p)));
    if (lists.some(l => !l.length)) return null;
    let best = null;
    const walk = (i, acc) => {
      if (i === lists.length) {
        const c = outfitCost(acc);
        if (o.budget && c.total > o.budget) return;
        const better = !best || (o.budget ? c.total > best.total : c.total < best.total) || (c.total === best.total && c.ships < best.ships);
        if (better) best = {ps:[...acc], ...c};
        return;
      }
      lists[i].forEach(p => walk(i + 1, [...acc, p]));
    };
    walk(0, []);
    return best;
  };
  let res = tryCats(plan), dropped = null;
  if (!res) { res = tryCats(plan.slice(0, 2)); if (res) dropped = plan[2]; }
  if (!res) {
    botSay(o.budget ? `ما قدرت أجمع لبسة توصل ${o.when} ضمن ${sar(o.budget)}. تبغى أرفع الميزانية شوي؟` : `ما فيه لبسة كاملة توصل ${o.when}. جرّب موعد أبعد.`,
      {kind:'quick', qs: o.budget ? [`عندي مناسبة ${o.when} ميزانيتي ${o.budget + 150}`] : ['عندي مناسبة خلال أسبوع']});
    return;
  }
  const sel = {}; res.ps.forEach(p => { const z = Object.entries(p.sizes); sel[p.id] = usualSize(p) || (z.find(([,n]) => n > 0) || [null])[0]; });
  const lead = `جهزت لك لبسة ${g === 'w' ? 'نسائية' : 'رجالية'} من ${res.ships === 1 ? 'متجر واحد' : res.ships + ' متاجر'}، كلها توصل قبل ${o.when}` +
    (o.budget ? ` وضمن ميزانيتك.` : '.') + (dropped ? ` ما لقيت ${CATS[dropped].one} يوصل بالوقت، فخليتها قطعتين.` : '');
  botSay(lead, {kind:'outfit', ids: res.ps.map(p => p.id), sel, total: res.total, ships: res.ships, budget: o.budget});
  S.occ = null; save();
}
function outfitPanel(m, live){
  const ps = m.ids.map(byId);
  const panel = h('div', {class:'panel outfit'});
  panel.append(...ps.map(p => {
    const z = Object.entries(p.sizes), s = shipFor(p.mid, p.price);
    return h('div', {class:'row2'},
      h('div', {class:'art', html:art(p)}),
      h('div', {style:'flex:1;min-width:0'}, h('div', {class:'pn'}, p.name),
        h('div', {class:'pm'}, `${MERCHANTS[p.mid].name} · ${sar(unitPrice(p))} · يصل ${dayName(s.days)}`)),
      z.length > 1 ? h('select', {'aria-label':'مقاس ' + p.name, disabled: !live || m.done, onchange:e => { m.sel[p.id] = e.target.value; save(); }},
        z.map(([k,n]) => h('option', {value:k, disabled: n <= 0, selected: m.sel[p.id] === k}, n > 0 ? k : k + ' (نفد)'))) : null);
  }));
  panel.append(h('div', {class:'sumline'}, h('span', {}, `الإجمالي مع الشحن (${m.ships === 1 ? 'شحنة واحدة' : m.ships + ' شحنات'})`), h('span', {}, sar(m.total))));
  if (m.budget) panel.append(h('div', {class:'ps free'}, `باقي لك ${sar(m.budget - m.total)} من الميزانية`));
  if (m.done) panel.append(h('div', {class:'slabel'}, 'أُضيفت اللبسة للسلة'));
  else panel.append(h('button', {class:'primary', disabled: !live, onclick:() => {
    ps.forEach(p => { addToCart(p.id, m.sel[p.id], 1); rememberSize(p, m.sel[p.id]); });
    m.done = true; save();
    botSay(`أضفت اللبسة كاملة (${ps.length} قطع) للسلة.`, {kind:'added'});
  }}, `أضف اللبسة كاملة (${ps.length} قطع)`));
  return panel;
}

/* ---------- haggling (rules only, no AI) ---------- */
const HAGGLE_LINES = ['صعبة والله، بس عشانك أنزل لـ {n}.', 'لا لا، خسرتني! أقدر أوصل لـ {n}.', 'هذي بضاعة نظيفة… {n} وما أقدر أنزل أكثر.'];
function startHaggle(pid){
  const p = byId(pid), m = MERCHANTS[p.mid];
  if (S.view !== 'chat') go('chat');
  push({role:'me', text:`كاسرني على ${p.name}`});
  if (!m.floor) { botSay(`${m.name} أسعاره ثابتة وما يقبل المكاسرة، بس شحنه مجاني دائمًا.`); return; }
  S.haggle[pid] = {ask:p.price, round:0};
  botSay(`سعر «${p.name}» ${sar(p.price)}. كم تعطيني؟`, {kind:'haggle', pid});
}
function offer(pid, o){
  const p = byId(pid), m = MERCHANTS[p.mid], H = S.haggle[pid] || (S.haggle[pid] = {ask:p.price, round:0});
  const min = Math.ceil(p.price * (1 - m.floor));
  if (!(o > 0)) { botSay('اكتب رقم بالريال، مثل 60.', {kind:'haggle', pid}); return; }
  if (o >= H.ask) return accept(pid, H.ask, 'تم بالسعر اللي اتفقنا عليه.');
  if (o >= min) return accept(pid, Math.round(o), 'مبروك عليك! اتفقنا.');
  H.round++;
  if (H.round >= 3 || H.ask <= min) { H.ask = min; save(); botSay(`آخر كلام ${sar(min)}، وأنت الكسبان.`, {kind:'hagglefinal', pid}); return; }
  const counter = Math.max(min, round5((o + H.ask) / 2));
  H.ask = counter; save();
  botSay(HAGGLE_LINES[(H.round - 1) % HAGGLE_LINES.length].replace('{n}', sar(counter)), {kind:'haggle', pid});
}
function accept(pid, price, lead){
  const p = byId(pid);
  S.deals[pid] = {price, until: Date.now() + 30 * 60000};
  delete S.haggle[pid]; save();
  botSay(`${lead} صار سعر «${p.name}» لك ${sar(price)} بدل ${sar(p.price)}، لمدة 30 دقيقة.`);
  chooseSizeFor(pid);
}
function haggleUI(m){
  const p = byId(m.pid), H = S.haggle[m.pid] || {ask:p.price};
  if (m.kind === 'hagglefinal') {
    const min = Math.ceil(p.price * (1 - MERCHANTS[p.mid].floor));
    return h('div', {class:'qr'},
      h('button', {class:'q', onclick:() => { push({role:'me', text:'تم، موافق'}); accept(m.pid, min, 'على البركة!'); }}, 'تم، موافق'),
      h('button', {class:'q', onclick:() => { push({role:'me', text:'لا شكرًا'}); delete S.haggle[m.pid]; botSay('ولا يهمك، السعر الأصلي موجود لو غيّرت رأيك.'); }}, 'لا شكرًا'));
  }
  const opts = [...new Set([0.95, 0.9, 0.8].map(k => round5(H.ask * k)).filter(v => v < H.ask))];
  const inp = h('input', {type:'number', inputmode:'numeric', min:'1', id:'offer-' + m.pid, 'aria-label':'عرضك بالريال', placeholder:'عرضك'});
  return h('div', {style:'display:flex;flex-direction:column;gap:8px'},
    h('div', {class:'qr'}, opts.map(v => h('button', {class:'q', onclick:() => { push({role:'me', text:`أعطيك ${v}`}); offer(m.pid, v); }}, `${v} ريال`))),
    h('form', {class:'offer', onsubmit:e => { e.preventDefault(); const v = +inp.value; if (!v) return; push({role:'me', text:`أعطيك ${v}`}); offer(m.pid, v); }},
      inp, h('button', {class:'ghost', style:'min-height:38px', type:'submit'}, 'أرسل العرض')));
}

/* ---------- cart ---------- */
const cartCount = () => S.cart.reduce((a,c) => a + c.qty, 0);
function addToCart(pid, size, qty){
  const p = byId(pid), max = p.sizes[size] || 0;
  const ex = S.cart.find(c => c.pid === pid && c.size === size);
  const want = Math.min(max, (ex ? ex.qty : 0) + qty);
  const by = S.fam && S.fam.on ? S.fam.who : null;
  if (ex) ex.qty = want; else S.cart.push({pid, size, qty:want, by});
  save(); renderHeader();
}
function groups(){
  const g = {};
  for (const c of S.cart) { const p = byId(c.pid); (g[p.mid] ||= []).push({...c, p}); }
  return Object.entries(g).map(([mid, items]) => {
    const sub = items.reduce((a,i) => a + unitPrice(i.p) * i.qty, 0);
    return {mid, items, sub, ...shipFor(mid, sub)};
  });
}

/* ---------- rendering ---------- */
function renderHeader(){
  const top = S.view === 'chat' || S.view === 'browse';
  $('#menuBtn').innerHTML = top ? icon('menu') : icon('back');
  $('#menuBtn').setAttribute('aria-label', top ? 'القائمة' : 'رجوع');
  $('#homeBtn').innerHTML = LOGO(28) + '<span>متاجر أصالة</span>';
  const n = cartCount();
  $('#cartBtn').innerHTML = icon('bag') + (n ? `<span class="badge">${n}</span>` : '');
  $('#cartBtn').setAttribute('aria-label', n ? `السلة، فيها ${n}` : 'السلة فارغة');
  const modes = $('#modes'); modes.replaceChildren();
  modes.hidden = !(S.view === 'chat' || S.view === 'browse');
  modes.append(h('div', {class:'seg'},
    h('button', {'aria-pressed': String(S.view === 'chat'), onclick:() => go('chat')}, 'محادثة'),
    h('button', {'aria-pressed': String(S.view === 'browse'), onclick:() => go('browse')}, 'تصفّح')));
}

function productCard(p){
  const s = shipFor(p.mid, p.price);
  return h('div', {class:'card'},
    h('div', {class:'art', html:art(p)}),
    h('div', {class:'cb'},
      h('div', {class:'pn'}, p.name),
      h('div', {class:'pm'}, MERCHANTS[p.mid].name),
      priceEl(p),
      h('div', {class:'ps' + (s.free ? ' free' : '')}, (s.free ? 'شحن مجاني' : `شحن ${s.fee}`) + ` · يصل ${dayName(s.days)}`),
      h('div', {class:'cardbtns'},
        h('button', {class:'primary', onclick:() => { push({role:'me', text:`آخذ ${p.name}`}); chooseSizeFor(p.id); }}, 'اختيار'),
        h('button', {class:'ghost', onclick:() => openDetails(p)}, 'التفاصيل'))));
}

function quick(qs){
  return h('div', {class:'qr'}, qs.map(q => h('button', {class:'q', onclick:() => handle(q)}, q)));
}

function renderBotBody(m, isLast){
  const body = [];
  if (m.kind === 'typing') return [h('div', {class:'typing', 'aria-label':'يكتب'}, h('i'), h('i'), h('i'))];
  if (m.text) body.push(h('div', {}, m.text));
  if (m.kind === 'results') {
    if (m.f) body.push(h('div', {class:'chips'}, filterChips(m.f).map(c => h('span', {class:'chip'}, c.t,
      !c.fixed && isLast ? h('button', {'aria-label':'إزالة '+c.t, onclick:() => removeFilter(m.f, c.k)}, '×') : null))));
    const ids = m.ids || [];
    if (ids.length) {
      body.push(h('div', {class:'row'}, ids.map(id => productCard(byId(id)))));
      if (isLast) body.push(quick([ids.length > 1 ? 'قارن بينهم' : null, 'الأرخص أول', 'شحن مجاني فقط', 'غيّر المدينة'].filter(Boolean)));
    } else if (isLast) body.push(quick(['تيشيرتات','أحذية','عبايات','شنط']));
  }
  if (m.kind === 'quick' && isLast) body.push(quick(m.qs));
  if ((m.kind === 'haggle' || m.kind === 'hagglefinal') && isLast) body.push(haggleUI(m));
  if (m.kind === 'outfit') body.push(outfitPanel(m, isLast));
  if (m.kind === 'cartlink') body.push(h('button', {class:'primary', onclick:() => go('cart')}, `افتح السلة (${cartCount()})`));
  if (m.kind === 'pick') body.push(pickPanel(m, isLast));
  if (m.kind === 'added') body.push(h('div', {class:'qr'},
    h('button', {class:'q', onclick:() => go('cart')}, 'افتح السلة'),
    isLast ? h('button', {class:'q', onclick:() => handle('أكمل التسوق')}, 'أكمل التسوق') : null));
  if (m.kind === 'compare') body.push(compareTable(m.ids));
  if (m.kind === 'orders') { const o = S.orders.find(x => x.id === m.oid); if (o) body.push(orderBlock(o, true)); }
  return body;
}

function pickPanel(m, live){
  const p = byId(m.pid);
  const sizes = Object.entries(p.sizes);
  const single = sizes.length === 1;
  const panel = h('div', {class:'panel'});
  const draw = () => {
    panel.replaceChildren();
    panel.append(h('div', {class:'mini'}, h('div', {class:'art', html:art(p)}),
      h('div', {class:'grow'}, h('div', {class:'pn'}, p.name), h('div', {class:'pm'}, MERCHANTS[p.mid].name)),
      h('div', {class:'pp'}, sar(unitPrice(p) * m.qty))));
    if (m.done) { panel.append(h('div', {class:'slabel'}, `أُضيف للسلة · ${single ? '' : 'المقاس ' + m.size + ' · '}الكمية ${m.qty}`)); return; }
    if (!single) panel.append(h('div', {class:'sizes', role:'group', 'aria-label':'المقاس'}, sizes.map(([s,n]) =>
      h('button', {class:'size', 'aria-pressed': String(m.size === s), disabled: n <= 0 || !live, 'aria-label': n <= 0 ? `${s} غير متوفر` : `مقاس ${s}`,
        onclick:() => { m.size = s; m.auto = false; m.qty = Math.min(m.qty, n); rememberSize(p, s); save(); draw(); }}, s))));
    if (!single && m.auto && m.size) panel.append(h('div', {class:'mysize'}, `اخترنا مقاسك المعتاد ${m.size}. تقدر تغيّره.`));
    const out = sizes.filter(([,n]) => n <= 0).map(([z]) => z);
    if (live && out.length) panel.append(alertBtn(p, out));
    const max = m.size ? p.sizes[m.size] : 0;
    panel.append(h('div', {style:'display:flex;justify-content:space-between;align-items:center;gap:8px'},
      h('div', {class:'step'},
        h('button', {'aria-label':'إنقاص الكمية', disabled: !live || m.qty <= 1, onclick:() => { m.qty--; save(); draw(); }}, '−'),
        h('span', {'aria-live':'polite'}, m.qty),
        h('button', {'aria-label':'زيادة الكمية', disabled: !live || !m.size || m.qty >= max, onclick:() => { m.qty++; save(); draw(); }}, '+')),
      m.size && max <= 3 ? h('span', {class:'ps', style:'color:var(--warn)'}, `باقي ${max} فقط`) : h('span')));
    panel.append(h('button', {class:'primary', disabled: !live || !m.size, onclick:() => {
      addToCart(p.id, m.size, m.qty); rememberSize(p, m.size); m.done = true; save();
      botSay(`أضفت ${p.name} للسلة. تبغى تكمل ولا ندفع؟`, {kind:'added'});
    }}, m.size ? 'أضف إلى السلة' : 'اختر المقاس أولًا'));
    if (live && MERCHANTS[p.mid].floor > 0 && unitPrice(p) === p.price) panel.append(h('button', {class:'linkbtn', onclick:() => startHaggle(p.id)}, 'السعر غالي؟ كاسرني'));
  };
  draw();
  return panel;
}

function compareTable(ids){
  const ps = ids.map(byId);
  const cheapest = Math.min(...ps.map(p => p.price));
  const fastest = Math.min(...ps.map(p => shipFor(p.mid, p.price).days));
  const rows = [
    ['السعر', p => h('span', {class: p.price === cheapest ? 'best' : ''}, sar(p.price))],
    ['المتجر', p => MERCHANTS[p.mid].name],
    ['الخامة', p => p.material],
    ['الشحن', p => { const s = shipFor(p.mid, p.price); return s.free ? 'مجاني' : `${s.fee} ر.س`; }],
    ['التوصيل', p => { const s = shipFor(p.mid, p.price); return h('span', {class: s.days === fastest ? 'best' : ''}, dayName(s.days)); }],
    ['المقاسات المتوفرة', p => Object.entries(p.sizes).filter(([,n]) => n > 0).map(([s]) => s).join('، ')]
  ];
  return h('div', {class:'tablewrap'}, h('table', {},
    h('thead', {}, h('tr', {}, h('th', {}, ''), ps.map(p => h('th', {}, p.name)))),
    h('tbody', {}, rows.map(([label, fn]) => h('tr', {}, h('th', {}, label), ps.map(p => h('td', {}, fn(p))))))));
}

function removeFilter(f, k){
  const nf = JSON.parse(JSON.stringify(f));
  if (k.startsWith('cat:')) nf.cats = nf.cats.filter(c => 'cat:'+c !== k);
  if (k === 'color') nf.color = null;
  if (k === 'price') { nf.max = null; nf.min = null; }
  if (k === 'size') nf.size = null;
  push({role:'me', text:'شيل فلتر ' + filterChips(f).find(c => c.k === k).t});
  runSearch(nf);
}

function renderChat(){
  const v = h('div', {class:'view', id:'thread'});
  if (!S.msgs.length) {
    v.append(h('div', {class:'hero'},
      h('div', {html:LOGO(60)}),
      h('h1', {}, 'وش تبغى تشتري اليوم؟'),
      h('p', {}, 'اكتب طلبك بكلامك، أو صوّر منتج عجبك')));
    const sug = (ic, b, s, q) => h('button', {class:'sug', onclick:() => q === '#photo' ? $('#photo').click() : handle(q)},
      h('span', {class:'ic', html:icon(ic,18)}), h('b', {}, b), h('span', {}, s));
    v.append(h('div', {class:'sugs'},
      sug('search', 'تيشيرت أسود', 'أقل من 80 ريال للمدينة', 'أبغى تيشيرت أسود أقل من 80 ريال ويوصل للمدينة'),
      sug('spark', 'عندي مناسبة', 'لبسة كاملة ضمن ميزانيتك', 'عندي عرس الخميس ميزانيتي 600'),
      sug('cam', 'ابحث بصورة', 'صوّر شي عجبك', '#photo'),
      sug('heart', 'هدية لأمي', 'بحدود 250 ريال', 'هدية لأمي بحدود 250')));
    v.append(h('div', {class:'cats'}, Object.entries(CATS).map(([k,c]) =>
      h('button', {class:'cat', onclick:() => { push({role:'me', text:c.label}); runSearch({cats:[k], color:null, max:null, min:null, size:null}); }}, c.label))));
    return v;
  }
  const lastBot = S.msgs.map(m => m.role).lastIndexOf('bot');
  S.msgs.forEach((m, i) => {
    if (m.role === 'me') {
      v.append(h('div', {class:'me'}, m.img ? h('img', {src:m.img, alt:'صورة من العميل'}) : null, m.text));
    } else {
      v.append(h('div', {class:'bot'},
        h('div', {class:'say'}, h('span', {class:'mark' + (m.ai ? ' ai' : ''), html:icon(m.ai ? 'spark' : 'bot', 22)}),
          h('div', {style:'flex:1;min-width:0;display:flex;flex-direction:column;gap:10px'}, renderBotBody(m, i === lastBot))),
        m.kind !== 'typing' ? h('div', {class:'who'}, m.ai ? 'فهمها الذكاء الاصطناعي' : 'رد البوت') : null));
    }
  });
  return v;
}

function renderCart(){
  const v = h('div', {class:'view'});
  v.append(h('h2', {style:'margin:0;font-size:20px'}, 'السلة'));
  if (!S.cart.length) {
    v.append(h('div', {class:'empty'}, h('div', {class:'okmark', html:icon('bag',30)}), h('div', {}, 'سلتك فاضية.'),
      h('button', {class:'primary', onclick:() => go('chat')}, 'ابدأ التسوق')));
    return v;
  }
  const G = groups();
  if (G.length > 1) v.append(h('div', {class:'note'}, `طلبك من ${G.length} متاجر، فيوصلك في ${G.length} شحنات منفصلة. تدفع مرة واحدة.`));
  G.forEach((g, gi) => {
    const m = MERCHANTS[g.mid];
    v.append(h('section', {class:'ship', 'aria-label':`الشحنة ${gi+1}`},
      h('div', {class:'shiphead'}, h('b', {}, `الشحنة ${gi+1} · ${m.name}`), h('span', {}, 'يصل ' + dayName(g.days))),
      g.items.map(it => h('div', {class:'item'},
        h('div', {class:'mini'}, h('div', {class:'art', html:art(it.p)})),
        h('div', {style:'flex:1;min-width:0'}, h('div', {class:'pn'}, it.p.name),
          h('div', {class:'pm'}, Object.keys(it.p.sizes).length > 1 ? 'المقاس ' + it.size : 'مقاس واحد'),
          S.fam.on ? h('div', {class:'by'}, 'أضافها: ' + (it.by || 'أنت')) : null,
          h('div', {class:'step', style:'margin-top:6px'},
            h('button', {'aria-label':'إنقاص الكمية', onclick:() => setQty(it, it.qty-1)}, it.qty === 1 ? h('span', {html:icon('trash',15)}) : '−'),
            h('span', {}, it.qty),
            h('button', {'aria-label':'زيادة الكمية', disabled: it.qty >= it.p.sizes[it.size], onclick:() => setQty(it, it.qty+1)}, '+'))),
        h('b', {style:'font-variant-numeric:tabular-nums'}, sar(unitPrice(it.p) * it.qty)))),
      h('div', {class:'line'}, h('span', {}, 'الشحن'), h('span', {class: g.free ? 'ps free' : ''}, g.free ? 'مجاني' : sar(g.fee))),
      h('div', {class:'line'}, h('span', {}, 'الإرجاع'), h('span', {}, m.ret)),
      nudge(g)));
  });
  v.append(h('div', {class:'field'}, h('label', {for:'city'}, 'التوصيل إلى'),
    h('select', {id:'city', onchange:e => { S.city = e.target.value; save(); renderMain(); }},
      CITIES.map(c => h('option', {value:c, selected: c === S.city}, c)))));
  v.append(familyBox());
  const gname = h('input', {class:'txt', id:'giftname', type:'text', placeholder:'اسم المستلم، مثل: أم محمد', value:S.gift.name || '', oninput:e => { S.gift.name = e.target.value; save(); }});
  v.append(h('div', {class:'giftbox'},
    h('label', {class:'check'}, h('input', {type:'checkbox', id:'gift', checked: S.gift.on, onchange:e => { S.gift.on = e.target.checked; save(); renderMain(); }}), 'هذا الطلب هدية'),
    S.gift.on ? h('div', {class:'field'}, h('label', {for:'giftname'}, 'لمين الهدية؟'), gname,
      h('div', {class:'pm'}, 'بنرسل له رابط على واتساب يختار فيه مقاسه ويكتب عنوانه، وما يشوف السعر.')) : null));
  const items = G.reduce((a,g) => a + g.sub, 0), ship = G.reduce((a,g) => a + g.fee, 0);
  v.append(h('div', {class:'totals'},
    h('div', {}, h('span', {}, 'المنتجات'), h('span', {}, sar(items))),
    h('div', {}, h('span', {}, `الشحن (${G.length === 1 ? 'شحنة واحدة' : G.length + ' شحنات'})`), h('span', {}, sar(ship))),
    h('div', {class:'grand'}, h('span', {}, 'الإجمالي'), h('span', {}, sar(items + ship))),
    h('span', {class:'pm'}, 'شامل ضريبة القيمة المضافة')));
  return v;
}
function familyBox(){
  const F = S.fam;
  const box = h('div', {class:'giftbox'},
    h('label', {class:'check'}, h('input', {type:'checkbox', id:'family', checked: F.on, onchange:e => { F.on = e.target.checked; save(); renderMain(); renderBottom(); }}), 'سلة العائلة'));
  if (!F.on) { box.append(h('div', {class:'pm'}, 'شارك السلة في قروب العائلة، كل واحد يضيف أغراضه، وتدفع مرة وحدة.')); return box; }
  const msg = `سويت سلة عائلية في متاجر أصالة 🛍\nأضف أغراضك قبل ما أدفع:\n${location.host}/stores/c/${(Date.now() % 100000)}`.replace(' 🛍', '');
  const msgBox = h('div', {class:'giftmsg'}, msg);
  const nameIn = h('input', {class:'txt', id:'famname', type:'text', placeholder:'اسم فرد من العائلة'});
  const addName = e => { e.preventDefault(); const n = nameIn.value.trim(); if (!n || F.people.includes(n)) return; F.people.push(n); F.who = n; save(); renderMain(); renderBottom(); };
  const shares = {};
  S.cart.forEach(c => { const k = c.by || 'أنت'; shares[k] = (shares[k] || 0) + unitPrice(byId(c.pid)) * c.qty; });
  box.append(
    h('div', {class:'pm'}, 'أرسل هالرسالة في قروب الواتساب (الرابط تجريبي):'), msgBox,
    h('button', {class:'ghost', style:'align-self:flex-start', onclick:e => { const b = e.currentTarget;
      navigator.clipboard.writeText(msg).then(() => { b.textContent = 'نسخت الرسالة'; }, () => { const r = document.createRange(); r.selectNodeContents(msgBox); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); b.textContent = 'حدّد النص وانسخه'; }); }}, 'انسخ الرسالة'),
    h('b', {style:'font-size:14px'}, 'مين يتسوق الحين؟'),
    h('div', {class:'people'}, F.people.map(n => h('button', {class:'chip', 'aria-pressed': String(F.who === n), style: F.who === n ? 'border-color:var(--brand);color:var(--brand);font-weight:600' : '',
      onclick:() => { F.who = n; save(); renderMain(); renderBottom(); }}, n))),
    h('form', {class:'addname', onsubmit:addName}, h('label', {for:'famname', class:'vh'}, 'اسم فرد من العائلة'), nameIn, h('button', {class:'ghost', type:'submit'}, 'أضف')),
    h('div', {class:'pm'}, `أي منتج ينضاف الحين ينحسب باسم «${F.who}». جرّب تبدّل الاسم وتضيف من المحادثة أو التصفح.`),
    Object.keys(shares).length ? h('div', {class:'totals'}, h('b', {style:'font-size:14px'}, 'نصيب كل واحد (بدون الشحن)'),
      Object.entries(shares).map(([n, v]) => h('div', {}, h('span', {}, n), h('span', {}, sar(v))))) : null);
  return box;
}
function nudge(g){
  const m = MERCHANTS[g.mid];
  if (g.free || !m.freeOver) return null;
  const gap = m.freeOver - g.sub;
  if (gap <= 0) return null;
  const inCart = new Set(S.cart.map(c => c.pid));
  const cands = PRODUCTS.filter(p => p.mid === g.mid && !inCart.has(p.id) && stock(p) > 0).sort((a,b) => a.price - b.price);
  const pick = cands.find(p => unitPrice(p) >= gap) || cands[cands.length - 1];
  return h('div', {class:'nudge'},
    h('div', {}, `أضف ${sar(gap)} من ${m.name} ويصير شحنها مجاني، وتوفر ${sar(g.fee)}.`),
    pick ? h('div', {class:'mini'}, h('div', {class:'art', html:art(pick)}),
      h('div', {class:'grow'}, h('div', {class:'pn'}, pick.name), h('div', {class:'pm'}, sar(unitPrice(pick)))),
      h('button', {class:'ghost', style:'min-height:36px', onclick:() => quickAdd(pick)}, 'أضف')) : null);
}
function alertBtn(p, sizes){
  const key = p.id + ':' + (sizes ? 'stock' : 'price');
  const on = S.alerts.includes(key);
  const label = sizes ? (on ? `بنبهك إذا توفر ${sizes.join('، ')}` : `نبهني إذا توفر ${sizes.join('، ')}`) : (on ? 'بنبهك إذا نزل السعر' : 'نبهني إذا نزل السعر');
  const b = h('button', {class:'linkbtn', 'aria-pressed': String(on), onclick:() => {
    if (S.alerts.includes(key)) S.alerts = S.alerts.filter(k => k !== key); else S.alerts.push(key);
    save(); toast(S.alerts.includes(key) ? 'تمام، بيوصلك إشعار.' : 'ألغينا التنبيه.'); b.replaceWith(alertBtn(p, sizes));
  }}, (on ? '✓ ' : '') + label);
  return b;
}
function setQty(it, q){
  const c = S.cart.find(x => x.pid === it.pid && x.size === it.size);
  if (!c) return;
  if (q <= 0) S.cart = S.cart.filter(x => x !== c); else c.qty = Math.min(q, byId(c.pid).sizes[c.size]);
  save(); renderHeader(); renderMain();
}

let paying = false;
function pay(btn){
  if (paying) return;               // a second tap while processing does nothing
  paying = true; btn.disabled = true; btn.textContent = 'جاري الدفع…';
  const key = S.payKey || (S.payKey = 'k' + Date.now());
  setTimeout(() => {
    if (S.orders.some(o => o.key === key)) { paying = false; return go('done'); }
    const G = groups();
    // re-check stock and prices from the catalog at payment time
    for (const g of G) for (const it of g.items) if ((it.p.sizes[it.size] || 0) < it.qty) {
      paying = false; btn.disabled = false; btn.textContent = 'ادفع';
      botSay(`الكمية المطلوبة من ${it.p.name} ما عادت متوفرة. عدّلت السلة.`); setQty(it, it.p.sizes[it.size]); return;
    }
    for (const g of G) for (const it of g.items) it.p.sizes[it.size] -= it.qty;
    const id = String(Math.floor(100000 + Math.random()*900000));
    const order = {id, key, at: Date.now(), city:S.city,
      total: G.reduce((a,g) => a + g.sub + g.fee, 0), gift: S.gift.on ? {name: (S.gift.name || '').trim() || 'صديقك'} : null,
      shipments: G.map((g,i) => ({n:i+1, mid:g.mid, fee:g.fee, days:g.days, items:g.items.map(it => ({pid:it.pid, size:it.size, qty:it.qty}))}))};
    S.orders.push(order); S.cart = []; S.payKey = null; S.gift = {on:false, name:''}; S.deals = {}; S.haggle = {}; paying = false; save();
    go('done');
  }, 1200);
}

const STEPS = ['تم الطلب','جاري التجهيز','تم الشحن','تم التوصيل'];
function stepOf(o, sh){ const min = (Date.now() - o.at) / 60000; const k = min * (sh.n === 1 ? 1 : 0.7); return k < 1 ? 0 : k < 3 ? 1 : k < 6 ? 2 : 3; }
function orderBlock(o, compact){
  return h('div', {style:'display:flex;flex-direction:column;gap:10px'},
    h('div', {class:'pm'}, `طلب رقم ${o.id} · ${sar(o.total)} · ${new Date(o.at).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn')}`),
    o.shipments.map(sh => {
      const st = stepOf(o, sh), m = MERCHANTS[sh.mid];
      return h('div', {class:'ship'},
        h('div', {class:'shiphead'}, h('b', {}, `الشحنة ${sh.n} · ${m.name}`), h('span', {class:'slabel'}, STEPS[st])),
        h('div', {style:'padding:10px 14px;display:flex;flex-direction:column;gap:6px'},
          sh.items.map(it => h('div', {class:'pm'}, `${byId(it.pid).name} × ${it.qty}`)),
          h('div', {class:'status', 'aria-label':`الحالة: ${STEPS[st]}`}, STEPS.map((_,i) => h('i', {class: i <= st ? 'on' : ''}))),
          h('div', {class:'ps'}, st < 3 ? `الوصول المتوقع: ${dayName(sh.days)}` : 'وصلت الشحنة'),
          !compact && st === 3 && !sh.ret ? h('button', {class:'ghost', style:'align-self:flex-start;min-height:36px', onclick:() => {
            sh.ret = 'R-' + Math.floor(1000 + Math.random()*9000); save(); renderMain();
          }}, 'طلب إرجاع') : null,
          sh.ret ? h('div', {class:'ps'}, `طلب إرجاع ${sh.ret} مفتوح. بنرسل لك بوليصة الإرجاع.`) : null));
    }));
}

function renderDone(){
  const o = S.orders[S.orders.length-1];
  return h('div', {class:'view'},
    h('div', {class:'empty', style:'padding-bottom:8px'}, h('div', {class:'okmark', html:icon('check',32)}),
      h('h2', {style:'margin:0;color:var(--ink)'}, 'تم الطلب'), h('div', {}, `رقم الطلب ${o.id}. تقدر تسأل «وين طلبي؟» في أي وقت.`)),
    o.gift ? giftPanel(o) : null,
    orderBlock(o, true),
    h('button', {class:'primary', onclick:() => go('chat')}, 'رجوع للمحادثة'));
}
function giftPanel(o){
  const msg = `يا ${o.gift.name}، وصلتك هدية من متاجر أصالة!\nاختر مقاسك واكتب عنوانك من هنا:\n${location.host}/stores/g/${o.id}`;
  const box = h('div', {class:'giftmsg'}, msg);
  return h('div', {class:'giftbox'},
    h('b', {}, 'رسالة الهدية'),
    h('div', {class:'pm'}, 'أرسلها له على واتساب. الرابط تجريبي.'),
    box,
    h('div', {style:'display:flex;gap:8px;flex-wrap:wrap'},
      h('button', {class:'ghost', onclick:e => {
        const btn = e.currentTarget;
        navigator.clipboard.writeText(msg).then(() => { btn.textContent = 'نسخت الرسالة'; },
          () => { const r = document.createRange(); r.selectNodeContents(box); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); btn.textContent = 'حدّد النص وانسخه'; });
      }}, 'انسخ الرسالة'),
      h('button', {class:'primary', onclick:() => openGiftView(o)}, 'شوف وش يشوف المستلم')));
}
function openGiftView(o){
  const close = () => bg.remove();
  const picks = {};
  const items = o.shipments.flatMap(sh => sh.items);
  items.forEach(it => picks[it.pid] = it.size);
  const city = h('select', {id:'giftcity', 'aria-label':'المدينة'}, CITIES.map(c => h('option', {value:c}, c)));
  const sheet = h('div', {class:'sheet', role:'dialog', 'aria-modal':'true', 'aria-label':'صفحة الهدية'});
  const bg = h('div', {class:'sheetbg', onclick:e => { if (e.target === bg) close(); }}, sheet);
  const draw = () => sheet.replaceChildren(
    h('div', {style:'text-align:center;display:flex;flex-direction:column;align-items:center;gap:6px'}, h('div', {html:LOGO(48)}),
      h('b', {style:'font-size:18px'}, `${o.gift.name}، وصلتك هدية!`), h('span', {class:'pm'}, 'اختر مقاسك ووين نوصلها لك. السعر مخفي.')),
    items.map(it => { const p = byId(it.pid), sz = Object.entries(p.sizes);
      return h('div', {class:'panel'},
        h('div', {class:'mini'}, h('div', {class:'art', html:art(p)}), h('div', {class:'grow'}, h('div', {class:'pn'}, p.name), h('div', {class:'pm'}, MERCHANTS[p.mid].name))),
        sz.length > 1 ? h('div', {class:'sizes', role:'group', 'aria-label':'المقاس'}, sz.map(([z,n]) =>
          h('button', {class:'size', 'aria-pressed': String(picks[p.id] === z), disabled: n <= 0 && picks[p.id] !== z, onclick:() => { picks[p.id] = z; draw(); }}, z))) : null); }),
    h('div', {class:'field'}, h('label', {for:'giftcity'}, 'التوصيل إلى'), city),
    h('div', {style:'display:flex;gap:8px'},
      h('button', {class:'primary', style:'flex:1', onclick:() => { close(); toast('تم. وصل للمرسل إن هديته في الطريق.'); }}, 'استلم هديتي'),
      h('button', {class:'ghost', onclick:close}, 'إغلاق')));
  draw(); document.body.append(bg);
  sheet.querySelector('.primary').focus();
  bg.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
}

function renderOrders(){
  const v = h('div', {class:'view'}, h('h2', {style:'margin:0;font-size:20px'}, 'طلباتي'));
  if (!S.orders.length) { v.append(h('div', {class:'empty'}, h('div', {class:'okmark', html:icon('box',30)}), 'ما عندك طلبات للحين.')); return v; }
  v.append(h('div', {class:'note'}, 'في النسخة التجريبية تتقدم حالة الشحنة تلقائيًا كل دقيقتين تقريبًا.'));
  [...S.orders].reverse().forEach(o => v.append(orderBlock(o, false)));
  return v;
}

function renderMenu(){
  const v = h('div', {class:'view'});
  v.append(h('div', {class:'menu'},
    h('button', {onclick:() => go('chat')}, h('span', {html:icon('search',20)}), 'المحادثة'),
    h('button', {onclick:() => go('orders')}, h('span', {html:icon('box',20)}), `طلباتي (${S.orders.length})`),
    h('button', {onclick:() => go('cart')}, h('span', {html:icon('bag',20)}), `السلة (${cartCount()})`),
    h('button', {onclick:() => { S.msgs = []; S.last = []; save(); go('chat'); }}, h('span', {html:icon('plus',20)}), 'محادثة جديدة'),
    h('button', {onclick:() => { try { localStorage.removeItem(KEY); } catch(e) {} location.reload(); }}, h('span', {html:icon('refresh',20)}), 'مسح بيانات التجربة'),
    h('button', {onclick:() => { location.href = '/'; }}, h('span', {html:icon('back',20)}), 'العودة لموقع أصالة')));
  const sz = Object.entries(S.mySize).map(([g,z]) => `${g === 'top' ? 'الملابس' : g === 'shoe' ? 'الأحذية' : 'العبايات'}: ${z}`);
  v.append(h('div', {class:'note'}, sz.length ? 'مقاساتي المحفوظة · ' + sz.join(' · ') : 'مقاساتك تنحفظ تلقائيًا أول ما تختارها، وتنختار لك في المرة الجاية.'));
  if (S.alerts.length) v.append(h('div', {class:'note'}, `عندك ${S.alerts.length} تنبيه على توفر المقاسات أو نزول الأسعار.`));
  v.append(h('h3', {style:'margin:8px 0 0;font-size:15px;display:flex;gap:8px;align-items:center'}, h('span', {html:icon('chart',18)}), 'من ردّ على العميل؟'));
  const tot = S.stats.bot + S.stats.ai;
  v.append(h('div', {class:'stats'},
    h('div', {class:'stat'}, h('b', {}, S.stats.bot), h('span', {}, 'ردود البوت (بدون تكلفة)')),
    h('div', {class:'stat'}, h('b', {}, S.stats.ai), h('span', {}, 'ردود الذكاء الاصطناعي'))));
  v.append(h('div', {class:'note'}, tot ? `${Math.round(S.stats.bot / tot * 100)}٪ من الردود في هذه التجربة تمت بالبوت فقط.` : 'ابدأ محادثة وشوف هنا كم رد احتاج الذكاء الاصطناعي.'));
  return v;
}

function openDetails(p){
  const s = shipFor(p.mid, p.price);
  const close = () => bg.remove();
  const bg = h('div', {class:'sheetbg', onclick:e => { if (e.target === bg) close(); }},
    h('div', {class:'sheet', role:'dialog', 'aria-modal':'true', 'aria-label':p.name},
      h('div', {class:'art', html:art(p)}),
      h('div', {}, h('div', {class:'pn', style:'font-size:17px'}, p.name), h('div', {class:'pm'}, MERCHANTS[p.mid].name)),
      priceEl(p, 'pp', 'font-size:20px'),
      h('div', {}, p.desc),
      h('dl', {class:'kv'},
        h('dt', {}, 'الخامة'), h('dd', {}, p.material),
        h('dt', {}, 'الإرجاع'), h('dd', {}, MERCHANTS[p.mid].ret),
        h('dt', {}, 'المقاسات'), h('dd', {}, Object.entries(p.sizes).map(([k,n]) => n > 0 ? k : k + ' (نفد)').join('، ')),
        h('dt', {}, 'الشحن إلى ' + S.city), h('dd', {}, (s.free ? 'مجاني' : sar(s.fee)) + ' · يصل ' + dayName(s.days))),
      h('div', {style:'display:flex;gap:16px;flex-wrap:wrap'},
        MERCHANTS[p.mid].floor > 0 && unitPrice(p) === p.price ? h('button', {class:'linkbtn', onclick:() => { close(); startHaggle(p.id); }}, 'كاسرني على السعر') : null,
        alertBtn(p, null)),
      reviewsBlock(p),
      completeLook(p, close),
      h('div', {style:'display:flex;gap:8px'},
        h('button', {class:'primary', style:'flex:1', onclick:() => { close(); push({role:'me', text:`آخذ ${p.name}`}); chooseSizeFor(p.id); }}, 'اختيار'),
        h('button', {class:'ghost', onclick:close}, 'إغلاق'))));
  document.body.append(bg);
  bg.querySelector('.primary').focus();
  bg.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
}


/* ---------- browsing ---------- */
const isFav = id => S.favs.includes(id);
function toggleFav(id){
  const p = byId(id);
  if (isFav(id)) S.favs = S.favs.filter(x => x !== id);
  else { S.favs.push(id); learn(p, 2); }
  save();
}
function learn(p, w){ S.taste[p.cat] = (S.taste[p.cat] || 0) + w; S.taste['c:' + p.color] = (S.taste['c:' + p.color] || 0) + w; }
const tasteScore = p => (S.taste[p.cat] || 0) + (S.taste['c:' + p.color] || 0) * 0.6;
function toast(t){ document.querySelectorAll('.toast').forEach(x => x.remove()); const el = h('div', {class:'toast', role:'status'}, t); document.body.append(el); setTimeout(() => el.remove(), 2200); }

function heartBtn(id, onchange){
  const b = h('button', {class:'heart', 'aria-pressed': String(isFav(id)), 'aria-label':'المفضلة', html:icon('heart',18)});
  b.addEventListener('click', e => { e.stopPropagation(); toggleFav(id); b.setAttribute('aria-pressed', String(isFav(id))); onchange && onchange(); });
  return b;
}
function browseCard(p, opts={}){
  const s = shipFor(p.mid, p.price);
  return h('div', {class:'card'},
    h('div', {class:'art'},
      h('button', {class:'artbtn', 'aria-label':'تفاصيل ' + p.name, onclick:() => openDetails(p), html:`<div class="art" style="background:transparent">${art(p)}</div>`}),
      NEW.includes(p.id) ? h('span', {class:'newtag'}, 'جديد') : null,
      heartBtn(p.id)),
    h('div', {class:'cb'},
      h('div', {class:'pn'}, p.name),
      h('div', {class:'pm'}, MERCHANTS[p.mid].name),
      priceEl(p),
      opts.total ? h('div', {class:'ps'}, `الإجمالي مع الشحن ${sar(p.price + s.fee)}`)
                 : h('div', {class:'ps' + (s.free ? ' free' : '')}, (s.free ? 'شحن مجاني' : `شحن ${s.fee}`) + ` · ${dayName(s.days)}`),
      h('div', {class:'cardbtns'}, h('button', {class:'primary', onclick:() => quickAdd(p)}, 'أضف للسلة'))));
}

function quickAdd(p){
  const sizes = Object.entries(p.sizes);
  const st = {size: sizes.length === 1 ? sizes[0][0] : usualSize(p), qty:1}; st.auto = sizes.length > 1 && !!st.size;
  const close = () => bg.remove();
  const sheet = h('div', {class:'sheet', role:'dialog', 'aria-modal':'true', 'aria-label':'إضافة ' + p.name});
  const bg = h('div', {class:'sheetbg', onclick:e => { if (e.target === bg) close(); }}, sheet);
  const draw = () => {
    sheet.replaceChildren(
      h('div', {class:'mini'}, h('div', {class:'art', html:art(p)}),
        h('div', {class:'grow'}, h('div', {class:'pn'}, p.name), h('div', {class:'pm'}, MERCHANTS[p.mid].name)),
        h('div', {class:'pp'}, sar(unitPrice(p) * st.qty))),
      sizes.length > 1 ? h('div', {class:'sizes', role:'group', 'aria-label':'المقاس'}, sizes.map(([z,n]) =>
        h('button', {class:'size', 'aria-pressed': String(st.size === z), disabled: n <= 0, onclick:() => { st.size = z; st.auto = false; st.qty = Math.min(st.qty, n); draw(); }}, z))) : null,
      st.auto ? h('div', {class:'mysize'}, `اخترنا مقاسك المعتاد ${st.size}. تقدر تغيّره.`) : null,
      sizes.some(([,n]) => n <= 0) ? alertBtn(p, sizes.filter(([,n]) => n <= 0).map(([z]) => z)) : null,
      h('div', {class:'step'},
        h('button', {'aria-label':'إنقاص الكمية', disabled: st.qty <= 1, onclick:() => { st.qty--; draw(); }}, '−'),
        h('span', {}, st.qty),
        h('button', {'aria-label':'زيادة الكمية', disabled: !st.size || st.qty >= p.sizes[st.size], onclick:() => { st.qty++; draw(); }}, '+')),
      h('div', {style:'display:flex;gap:8px'},
        h('button', {class:'primary', style:'flex:1', disabled: !st.size, onclick:() => {
          addToCart(p.id, st.size, st.qty); rememberSize(p, st.size); learn(p, 3); save(); close(); toast(`أُضيف ${p.name} للسلة`);
          if (S.view === 'browse') renderMain();
        }}, st.size ? 'أضف للسلة' : 'اختر المقاس'),
        h('button', {class:'ghost', onclick:close}, 'إلغاء')));
  };
  draw(); document.body.append(bg);
  bg.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  (sheet.querySelector('.size:not([disabled])') || sheet.querySelector('.primary')).focus();
}

function reviewsBlock(p){
  const rs = REVIEWS[p.id];
  if (!rs) return h('div', {class:'look'}, h('div', {class:'pm'}, 'ما فيه تقييمات على هذا المنتج للحين.'));
  const avg = rs.reduce((a,r) => a + r[0], 0) / rs.length;
  const out = h('div', {class:'summary', hidden:true, 'aria-live':'polite'});
  const btn = h('button', {class:'linkbtn', onclick:() => summarize(p, rs, out, btn)}, 'لخّص لي الآراء');
  return h('div', {class:'look'},
    h('div', {class:'sec'}, h('h3', {style:'font-size:15px'}, 'آراء المشترين'), h('span', {}, 'تقييمات تجريبية للعرض')),
    h('div', {}, h('span', {class:'stars', 'aria-hidden':'true'}, '★'.repeat(Math.round(avg)) + '☆'.repeat(5 - Math.round(avg))),
      ` ${avg.toFixed(1)} من 5 · ${rs.length} تقييمات`),
    rs.slice(0, 2).map(r => h('div', {class:'rev'}, h('span', {class:'stars', 'aria-label':`${r[0]} من 5`}, '★'.repeat(r[0])), ' ', r[1])),
    btn, out);
}
function ruleSummary(rs){
  const all = rs.map(r => norm(r[1])).join(' ');
  const lines = [];
  if (/مقاس صغير|صغير شوي/.test(all)) lines.push('المقاس: بعضهم يقول صغير شوي، خذ أكبر بمقاس.');
  else if (/مقاس كبير|كبير شوي/.test(all)) lines.push('المقاس: بعضهم يقول كبير شوي، خذ أصغر بمقاس.');
  else if (/مضبوط/.test(all)) lines.push('المقاس: أغلبهم يقولون مضبوط.');
  if (/ممتاز|فخم|مريح|حلو/.test(all)) lines.push('الإيجابيات: الجودة والراحة أكثر شي مدحوه.');
  const neg = rs.filter(r => r[0] <= 3 && !/مقاس/.test(norm(r[1]))).map(r => r[1]);
  if (neg.length) lines.push('الملاحظات: ' + neg.join('، ') + '.');
  return lines.join('\n') || 'الآراء إيجابية بشكل عام.';
}
async function summarize(p, rs, out, btn){
  out.hidden = false; btn.disabled = true;
  if (!sample) { out.textContent = ruleSummary(rs); btn.remove(); return; }
  out.textContent = 'يقرأ الآراء…';
  try {
    const list = rs.map(r => `- (${r[0]}/5) ${r[1]}`).join('\n');
    out.textContent = await shopAI({task:'reviews', name:p.name, reviews:rs.slice(0,20)});
    S.stats.ai++; save(); btn.remove();
  } catch(e) {
    if (e && (e.code === 'not_granted' || e.code === 'sampling_disabled')) sample = null;
    out.textContent = ruleSummary(rs); btn.remove();
  }
}
function completeLook(p, closeParent){
  const cats = GOES_WITH[p.cat] || [];
  const picks = cats.map(c => PRODUCTS.filter(x => x.cat === c && x.mid !== p.mid && stock(x) > 0).sort((a,b) => tasteScore(b) - tasteScore(a) || a.price - b.price)[0]
    || PRODUCTS.find(x => x.cat === c && stock(x) > 0)).filter(Boolean).slice(0,3);
  if (!picks.length) return null;
  return h('div', {class:'look'},
    h('div', {class:'sec'}, h('h3', {style:'font-size:15px'}, 'كمّل اللوك'), h('span', {}, 'من متاجر ثانية، في نفس السلة')),
    picks.map(x => h('div', {class:'item mini'},
      h('div', {class:'art', html:art(x)}),
      h('div', {class:'grow'}, h('div', {class:'pn'}, x.name), h('div', {class:'pm'}, `${MERCHANTS[x.mid].name} · ${sar(x.price)}`)),
      h('button', {class:'ghost', style:'min-height:36px', onclick:() => { closeParent(); quickAdd(x); }}, 'أضف'))));
}

const initial = n => { const w = n.split(' ').filter(x => !['متجر','بيت'].includes(x))[0] || n; return w.replace(/^(ال|لل)/, '').replace(/^[إأآ]/, 'ا').slice(0,1); };
function storyMerchants(){
  return Object.keys(MERCHANTS).filter(mid => NEW.some(id => byId(id).mid === mid));
}
function renderBrowse(){
  const v = h('div', {class:'view'});
  // stories
  v.append(h('div', {class:'sec'}, h('h3', {}, 'وصل جديد'), h('span', {}, 'اضغط على المتجر')));
  v.append(h('div', {class:'stories'}, storyMerchants().map(mid => {
    const m = MERCHANTS[mid];
    return h('button', {class:'story', onclick:() => openStories(mid), 'aria-label':`جديد ${m.name}`},
      h('span', {class:'ring' + (S.seen[mid] ? ' seen' : '')}, h('span', {}, initial(m.name))),
      m.name);
  })));
  // discover
  v.append(h('button', {class:'discover', onclick:openDiscover},
    h('span', {class:'dic', html:icon('play',24)}),
    h('span', {}, h('b', {}, 'اكتشف'), h('span', {}, 'اسحب للأعلى منتج منتج، ويتعلم ذوقك'))));
  // budget
  const fits = PRODUCTS.filter(p => stock(p) > 0 && p.price + shipFor(p.mid, p.price).fee <= S.budget);
  const big = h('span', {class:'big'}, sar(S.budget));
  const count = h('span', {class:'pm'});
  const results = h('div', {style:'display:flex;flex-direction:column;gap:14px'});
  const drawBudget = () => {
    const list = PRODUCTS.filter(p => stock(p) > 0 && p.price + shipFor(p.mid, p.price).fee <= S.budget);
    big.textContent = sar(S.budget);
    count.textContent = `${list.length} منتج يوصلك بهالمبلغ شامل الشحن إلى ${S.city}`;
    results.replaceChildren();
    const byCat = {};
    list.sort((a,b) => tasteScore(b) - tasteScore(a) || a.price - b.price).forEach(p => (byCat[p.cat] ||= []).push(p));
    Object.entries(byCat).forEach(([c, ps]) => results.append(
      h('div', {class:'sec'}, h('h3', {style:'font-size:15px'}, CATS[c].label), h('span', {}, ps.length)),
      h('div', {class:'row'}, ps.map(p => browseCard(p, {total:true})))));
    if (!list.length) results.append(h('div', {class:'note'}, 'ما فيه شي بهالمبلغ. زِد الميزانية شوي.'));
  };
  const range = h('input', {type:'range', id:'budget', min:'50', max:'400', step:'10', value:String(S.budget), 'aria-label':'الميزانية بالريال'});
  range.addEventListener('input', () => { S.budget = +range.value; drawBudget(); });
  range.addEventListener('change', save);
  v.append(h('div', {class:'budget'},
    h('label', {for:'budget', style:'font-weight:600'}, 'عندي'), big, range, count));
  v.append(results);
  drawBudget();
  // all products
  v.append(h('div', {class:'sec', style:'margin-top:8px'}, h('h3', {}, 'كل المنتجات'), h('span', {}, `${PRODUCTS.length} منتج من ${Object.keys(MERCHANTS).length} متاجر`)));
  const grid = h('div', {class:'grid'});
  const drawGrid = () => {
    let list = PRODUCTS.filter(p => S.gcat === 'all' || (S.gcat === 'fav' ? isFav(p.id) : p.cat === S.gcat));
    const eta = p => shipFor(p.mid, p.price).days;
    if (S.sort === 'new') list.sort((a,b) => (NEW.includes(b.id) - NEW.includes(a.id)) || tasteScore(b) - tasteScore(a));
    if (S.sort === 'cheap') list.sort((a,b) => a.price - b.price);
    if (S.sort === 'fast') list.sort((a,b) => eta(a) - eta(b) || a.price - b.price);
    grid.replaceChildren(...list.map(p => browseCard(p)));
    if (!list.length) grid.append(h('div', {class:'note', style:'grid-column:1/-1'}, S.gcat === 'fav' ? 'اضغط القلب على أي منتج ليظهر هنا.' : 'ما فيه منتجات هنا.'));
  };
  const chips = h('div', {class:'chips'});
  const drawChips = () => chips.replaceChildren(...[['all','الكل'],['fav','المفضلة'],...Object.entries(CATS).map(([k,c]) => [k,c.label])].map(([k,t]) =>
    h('button', {class:'chip', style: S.gcat === k ? 'border-color:var(--brand);color:var(--brand);font-weight:600' : '', 'aria-pressed': String(S.gcat === k),
      onclick:() => { S.gcat = k; save(); drawChips(); drawGrid(); }}, t)));
  const sort = h('select', {id:'sort', 'aria-label':'الترتيب', onchange:e => { S.sort = e.target.value; save(); drawGrid(); }},
    [['new','الأحدث'],['cheap','الأرخص'],['fast','الأسرع توصيلًا']].map(([k,t]) => h('option', {value:k, selected: S.sort === k}, t)));
  v.append(chips, h('div', {class:'sortbar'}, h('span', {class:'pm'}, 'التوصيل إلى ' + S.city), sort), grid);
  drawChips(); drawGrid();
  return v;
}

/* stories viewer */
function openStories(startMid){
  const mids = storyMerchants();
  let mi = mids.indexOf(startMid), ii = 0, timer = null, t0 = 0, paused = false, left = 5000;
  const D = 5000;
  const full = h('div', {class:'full', role:'dialog', 'aria-modal':'true', 'aria-label':'وصل جديد'});
  const close = () => { clearTimeout(timer); full.remove(); renderMain(); };
  const items = () => NEW.map(byId).filter(p => p.mid === mids[mi]);
  const next = () => { const its = items(); if (ii < its.length - 1) { ii++; show(); } else if (mi < mids.length - 1) { mi++; ii = 0; show(); } else close(); };
  const prev = () => { if (ii > 0) { ii--; show(); } else if (mi > 0) { mi--; ii = items().length - 1; show(); } else show(); };
  const run = ms => { clearTimeout(timer); t0 = Date.now(); left = ms; timer = setTimeout(next, ms); const b = full.querySelector('.bars i.cur b'); if (b) { b.style.transition = 'none'; b.style.width = ((D - ms) / D * 100) + '%'; requestAnimationFrame(() => requestAnimationFrame(() => { b.style.transition = `width ${ms}ms linear`; b.style.width = '100%'; })); } };
  const pause = () => { if (paused) return; paused = true; clearTimeout(timer); left = Math.max(300, left - (Date.now() - t0)); const b = full.querySelector('.bars i.cur b'); if (b) { const w = getComputedStyle(b).width; b.style.transition = 'none'; b.style.width = w; } };
  const resume = () => { if (!paused) return; paused = false; run(left); };
  function show(){
    const its = items(), p = its[ii], m = MERCHANTS[p.mid], s = shipFor(p.mid, p.price);
    S.seen[p.mid] = true; save();
    const like = h('button', {class:'roundbtn', 'aria-pressed': String(isFav(p.id)), 'aria-label':'المفضلة', html:icon('heart',24),
      onclick:() => { toggleFav(p.id); like.setAttribute('aria-pressed', String(isFav(p.id))); }});
    full.replaceChildren(
      h('div', {class:'bars'}, its.map((_, k) => h('i', {class: k === ii ? 'cur' : ''}, h('b', {style: k < ii ? 'width:100%' : ''})))),
      h('div', {class:'fullbar', style:'top:calc(20px + env(safe-area-inset-top, 0px))'},
        h('b', {}, `${m.name} · جديد`),
        h('button', {class:'roundbtn', style:'width:44px;height:44px', 'aria-label':'إغلاق', html:icon('x',22), onclick:close})),
      h('div', {class:'slide', style:'height:100%'},
        h('div', {class:'stage', html:art(p)}),
        h('button', {class:'tapzone', style:'right:0', 'aria-label':'السابق', onclick:prev}),
        h('button', {class:'tapzone', style:'left:0', 'aria-label':'التالي', onclick:next}),
        h('div', {class:'info'},
          h('div', {class:'nm'}, p.name),
          h('div', {class:'mt'}, `${p.material} · ${s.free ? 'شحن مجاني' : 'شحن ' + s.fee + ' ر.س'} · يصل ${dayName(s.days)}`),
          h('div', {class:'pr'}, sar(p.price)),
          h('div', {class:'acts'},
            h('button', {class:'want', onclick:() => { pause(); quickAdd(p); const iv = setInterval(() => { if (!document.querySelector('.sheetbg')) { clearInterval(iv); resume(); } }, 300); }}, 'أبيه'),
            like))));
    paused = false; run(D);
  }
  full.addEventListener('keydown', e => { if (e.key === 'Escape') close(); if (e.key === 'ArrowLeft') next(); if (e.key === 'ArrowRight') prev(); });
  document.body.append(full); show(); full.querySelector('.want').focus();
}

/* discover feed */
function openDiscover(){
  const pool = PRODUCTS.filter(p => stock(p) > 0);
  const shown = [];
  const pickBatch = () => {
    let rest = pool.filter(p => !shown.slice(-pool.length + 3).includes(p.id));
    rest = rest.sort((a,b) => (tasteScore(b) + Math.random() * 2) - (tasteScore(a) + Math.random() * 2)).slice(0,4);
    return rest;
  };
  const full = h('div', {class:'full', role:'dialog', 'aria-modal':'true', 'aria-label':'اكتشف'});
  const feed = h('div', {class:'feed'});
  const close = () => { io.disconnect(); full.remove(); renderMain(); };
  const why = p => { const top = Object.entries(S.taste).filter(([k,v]) => v > 1).sort((a,b) => b[1] - a[1])[0]; if (!top) return '';
    const [k] = top; if (k === p.cat) return `لأنك تحب ${CATS[k].label}`; if (k === 'c:' + p.color) return `لأنك تحب اللون ${COLORS[p.color].label}`; return ''; };
  const slide = p => {
    const s = shipFor(p.mid, p.price);
    const burst = h('span', {class:'burst', html:icon('heart',96)});
    const like = h('button', {class:'roundbtn', 'aria-pressed': String(isFav(p.id)), 'aria-label':'المفضلة', html:icon('heart',24)});
    const setLike = on => { if (on !== isFav(p.id)) toggleFav(p.id); like.setAttribute('aria-pressed', String(isFav(p.id))); };
    like.addEventListener('click', () => setLike(!isFav(p.id)));
    let lastTap = 0;
    const stage = h('button', {class:'stage', 'aria-label':'اضغط مرتين للإعجاب', html:art(p)});
    stage.addEventListener('click', () => { const now = Date.now(); if (now - lastTap < 350) { setLike(true); burst.classList.add('on'); setTimeout(() => burst.classList.remove('on'), 500); } lastTap = now; });
    const w = why(p);
    const el = h('section', {class:'slide', 'data-id':p.id},
      stage, burst,
      h('div', {class:'info'},
        w ? h('div', {class:'why'}, w) : null,
        h('div', {class:'nm'}, p.name),
        h('div', {class:'mt'}, `${MERCHANTS[p.mid].name} · ${s.free ? 'شحن مجاني' : 'شحن ' + s.fee + ' ر.س'} · يصل ${dayName(s.days)}`),
        h('div', {class:'pr'}, sar(p.price)),
        h('div', {class:'acts'}, h('button', {class:'want', onclick:() => quickAdd(p)}, 'أبيه'), like)));
    return el;
  };
  const append = () => pickBatch().forEach(p => { shown.push(p.id); const el = slide(p); feed.append(el); io.observe(el); });
  let cur = null, enter = 0;
  const io = new IntersectionObserver(es => es.forEach(e => {
    const p = byId(e.target.dataset.id);
    if (e.isIntersecting) {
      cur = p; enter = Date.now();
      if (e.target === feed.lastElementChild || e.target === feed.lastElementChild?.previousElementSibling) append();
    } else if (cur === p) {
      const dwell = Date.now() - enter;
      if (!isFav(p.id)) learn(p, dwell < 1500 ? -0.5 : dwell > 4000 ? 0.5 : 0);
      save();
    }
  }), {root:feed, threshold:0.6});
  full.append(feed,
    h('div', {class:'fullbar'},
      h('b', {}, 'اكتشف'),
      h('button', {class:'roundbtn', style:'width:44px;height:44px', 'aria-label':'إغلاق', html:icon('x',22), onclick:close})));
  full.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  document.body.append(full);
  append();
  feed.focus?.();
  if (!S.taste.__hinted) { S.taste.__hinted = 1; save(); toast('اسحب للأعلى للمنتج التالي، واضغط مرتين للإعجاب'); }
}

function renderBottom(){
  const b = $('#bottom'); b.replaceChildren();
  if (S.view === 'chat' || S.view === 'browse') {
    const input = h('input', {type:'text', id:'ask', placeholder:'اكتب طلبك… مثلًا: حذاء أبيض مقاس 42', autocomplete:'off', enterkeyhint:'send'});
    const send = h('button', {class:'send', type:'submit', 'aria-label':'إرسال', html:icon('up',20)});
    const form = h('form', {class:'inp', onsubmit:e => { e.preventDefault(); const t = input.value; input.value = ''; if (!t.trim()) return; if (S.view !== 'chat') go('chat'); handle(t); }},
      h('button', {type:'button', class:'iconbtn', 'aria-label':'ابحث بصورة', html:icon('cam'), onclick:() => $('#photo').click()}),
      h('label', {for:'ask', class:'vh'}, 'اكتب طلبك'), input, send);
    b.append(h('div', {class:'composer'}, form, h('div', {class:'hint'}, S.fam && S.fam.on ? `تتسوق باسم «${S.fam.who}» في سلة العائلة` : 'الأسعار والتوصيل من المتاجر مباشرة، وتُراجَع قبل الدفع')));
  } else if (S.view === 'cart' && S.cart.length) {
    const G = groups(), total = G.reduce((a,g) => a + g.sub + g.fee, 0);
    const btn = h('button', {class:'primary', onclick:e => pay(e.currentTarget)}, `ادفع ${sar(total)}`);
    b.append(h('div', {class:'paybar'}, btn, h('small', {}, 'دفع تجريبي · مدى · Apple Pay · بطاقة ائتمانية')));
  }
}

function renderMain(){
  const main = $('#main');
  const atBottom = main.scrollHeight - main.scrollTop - main.clientHeight < 80;
  main.replaceChildren(
    S.view === 'cart' ? renderCart() : S.view === 'done' ? renderDone() :
    S.view === 'orders' ? renderOrders() : S.view === 'menu' ? renderMenu() : S.view === 'browse' ? renderBrowse() : renderChat());
  if (S.view === 'chat' && (atBottom || S.msgs.length)) main.scrollTop = main.scrollHeight;
}
let lastTop = 'chat';
function go(view){ if (view === 'chat' || view === 'browse') lastTop = view; S.view = view; renderHeader(); renderMain(); renderBottom(); if (view !== 'chat') $('#main').scrollTop = 0; }

$('#menuBtn').addEventListener('click', () => go(S.view === 'chat' || S.view === 'browse' ? 'menu' : lastTop));
$('#homeBtn').addEventListener('click', () => go('chat'));
$('#cartBtn').addEventListener('click', () => go('cart'));
$('#photo').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) { go('chat'); photoSearch(f); } });
setInterval(() => { if (S.view === 'orders') renderMain(); }, 20000);

// images from earlier visits are gone after reload; drop their blob links
S.msgs.forEach(m => { if (m.img) m.img = null; });
S.msgs = S.msgs.filter(m => m.kind !== 'typing');
go('chat');
})();
