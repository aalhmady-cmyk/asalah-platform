// صوت نتيجة التحقق: جرس + صوت يقول النتيجة للأصلي، وطوط + تحذير للمقلّد.
// الجرس والطوط نولّدهم بالمتصفح (بدون ملفات)، والكلام بصوت الجوال (speechSynthesis).
let ctx;
const audio = () => (ctx ||= new (window.AudioContext || window.webkitAudioContext)());

function tone(c, freq, start, dur, { type = 'sine', vol = 0.35 } = {}) {
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(vol, start + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(c.destination);
  o.start(start);
  o.stop(start + dur + 0.05);
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// لو المتصفح مانع الصوت قبل أول لمسة، resume تعلّق، فنعطيها مهلة
async function ready() {
  const c = audio();
  if (c.state !== 'running') await Promise.race([c.resume(), wait(300)]);
  if (c.state !== 'running') throw new Error('blocked');
  return c;
}

// جرس "صح": نغمتين صاعدة مع رنين خفيف
export async function chime() {
  const c = await ready();
  const t = c.currentTime + 0.02;
  tone(c, 1318.5, t, 0.9);
  tone(c, 2637, t, 0.5, { vol: 0.08 });
  tone(c, 1975.5, t + 0.16, 1.2);
  tone(c, 3951, t + 0.16, 0.6, { vol: 0.06 });
  await wait(1000);
}

// "طوط طوط" تحذير
export async function buzz() {
  const c = await ready();
  const t = c.currentTime + 0.02;
  for (const k of [0, 0.42]) {
    tone(c, 330, t + k, 0.32, { type: 'square', vol: 0.18 });
    tone(c, 220, t + k, 0.32, { type: 'square', vol: 0.12 });
  }
  await wait(900);
}

function voiceFor(lang) {
  const all = speechSynthesis.getVoices();
  const base = lang.slice(0, 2);
  return all.find((v) => v.lang.replace('_', '-') === lang) || all.find((v) => v.lang.toLowerCase().startsWith(base));
}
async function voices() {
  if (speechSynthesis.getVoices().length) return;
  await Promise.race([new Promise((r) => speechSynthesis.addEventListener('voiceschanged', r, { once: true })), wait(1200)]);
}

// يقول الجملة إذا الجوال فيه صوت بنفس اللغة، وإلا يسكت (ما نقرأ عربي بصوت إنجليزي)
export async function say(text, lang = 'ar-SA') {
  if (!('speechSynthesis' in window)) return;
  await voices();
  const v = voiceFor(lang);
  if (!v) return;
  const u = new SpeechSynthesisUtterance(text);
  u.voice = v;
  u.lang = v.lang;
  u.rate = 0.95;
  const res = await Promise.race([new Promise((r) => { u.onend = () => r('ok'); u.onerror = (e) => r(e.error); speechSynthesis.speak(u); }), wait(9000)]);
  if (res === 'not-allowed') throw new Error('blocked');
}

const LINES = {
  ar: { hi: 'هلا والله، المنتج أصلي', thanks: 'شكراً إنك اخترت المنتج الأصلي، وصحتين وعافية!', warn: 'احذر! المنتج يُشتبه إنه مزوّر أو مقلّد. بلّغ عنه على الفور.', lang: 'ar-SA' },
  en: { hi: 'Welcome! This product is original.', thanks: 'Thank you for choosing the original. Enjoy!', warn: 'Warning! This product is suspected to be fake. Please report it right away.', lang: 'en-US' },
};

// يرجع 'blocked' إذا المتصفح منع الصوت (لازم لمسة من العميل)، وإلا 'ok'
export async function playResult(kind, en = false) {
  const l = LINES[en ? 'en' : 'ar'];
  try {
    window.speechSynthesis?.cancel();
    if (kind === 'original') {
      await say(l.hi, l.lang);
      await chime();
      await say(l.thanks, l.lang);
    } else {
      await buzz();
      await say(l.warn, l.lang);
    }
    return 'ok';
  } catch (e) {
    if (e.message === 'blocked') return 'blocked';
    throw e;
  }
}
