// صوت نتيجة التحقق: جرس + صوت يقول النتيجة للأصلي، وطوط + تحذير للمقلّد.
// الجرس والطوط نولّدهم بالمتصفح، والكلام ملفات صوت ثابتة في /assets/voice (تشتغل على أي جوال).
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

const clips = new Map();
// نحمّل الملف ونفكّه مرة وحدة، ونحتفظ فيه
function clip(name) {
  const url = name.startsWith('/') ? name : `/assets/voice/${name}.mp3`;
  if (!clips.has(name)) clips.set(name, fetch(url).then((r) => r.arrayBuffer()).then((b) => audio().decodeAudioData(b)));
  return clips.get(name);
}
export function preload(en = false) {
  try { for (const k of ['hi', 'thanks', 'warn']) clip(`${en ? 'en' : 'ar'}-${k}`).catch(() => clips.clear()); } catch { /* متصفح قديم بدون صوت */ }
}

async function speak(name) {
  const c = await ready();
  const buf = await clip(name);
  const src = c.createBufferSource();
  src.buffer = buf;
  src.connect(c.destination);
  await new Promise((r) => { src.onended = r; src.start(); });
}

// يرجع 'blocked' إذا المتصفح منع الصوت (لازم لمسة من العميل)، وإلا 'ok'
// custom: تسجيلات المدير العربية {hi, thanks, warn} تبدّل الافتراضي
export async function playResult(kind, en = false, custom = {}) {
  const line = (k) => (!en && custom?.[k]) || `${en ? 'en' : 'ar'}-${k}`;
  try {
    if (kind === 'original') {
      await speak(line('hi'));
      await chime();
      await speak(line('thanks'));
    } else {
      await buzz();
      await speak(line('warn'));
    }
    return 'ok';
  } catch (e) {
    if (e.message === 'blocked') return 'blocked';
    throw e;
  }
}
