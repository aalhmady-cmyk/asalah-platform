// الدخول والخروج وتغيير كلمة المرور، وإنشاء أول مدير عام.
import { pushAlert } from '../lib/push.js';
import { checkPassword, createSession, currentTokenHash, currentUser, destroySession, hashPassword, requireUser, sameOrigin, validPassword } from '../lib/auth.js';
import { checkCode, newSecret, otpauthUrl } from '../lib/totp.js';
import { requireHuman } from '../lib/human.js';
import { deviceKind } from '../lib/scans.js';
import { cityAr } from '../lib/trust.js';
import { audit, fail, geo, ipHash, json, now, randomHex, rateLimit, readJson, safeEqual, sha256, str } from '../lib/util.js';

const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name, role: u.role, merchant_id: u.merchant_id, merchant_role: u.role === 'merchant' ? u.merchant_role || 'owner' : null });

export async function login(req, env) {
  sameOrigin(req);
  const db = env.DB;
  await rateLimit(db, 'login:' + (await ipHash(req)), 10, 900);
  const b = await readJson(req);
  const email = str(b.email, 'البريد', { max: 200 }).toLowerCase();
  const password = str(b.password, 'كلمة المرور', { max: 200 });
  await requireHuman(env, req, b.cf_token);
  // حد لكل حساب كمان، عشان التخمين من أجهزة كثيرة ما ينفع
  await rateLimit(db, 'loginu:' + (await sha256(email)), 8, 900);
  const u = await db
    .prepare('SELECT u.*,m.status AS merchant_status FROM users u LEFT JOIN merchants m ON m.id=u.merchant_id WHERE u.email=?')
    .bind(email)
    .first();
  // نحسب الـ hash حتى لو الحساب غير موجود، عشان ما ينكشف وجوده من زمن الرد
  const ok = u ? await checkPassword(password, u) : (await hashPassword(password), false);
  if (!ok) fail(401, 'البريد أو كلمة المرور غير صحيحة');
  if (u.status !== 'active') fail(403, 'هذا الحساب موقوف');
  if (u.role === 'merchant' && u.merchant_status !== 'active') fail(403, 'حساب التاجر موقوف، تواصل مع إدارة أصالة');
  if (u.totp_on) {
    // كلمة المرور صح، باقي رمز التطبيق. التذكرة صالحة 5 دقائق
    const ticket = randomHex(24);
    await db.batch([
      db.prepare('DELETE FROM login_tickets WHERE expires_at<?').bind(now()),
      db.prepare('INSERT INTO login_tickets(ticket_hash,user_id,expires_at) VALUES(?,?,?)').bind(await sha256(ticket), u.id, now() + 300),
    ]);
    return json({ ok: true, need_2fa: true, ticket });
  }
  return finishLogin(req, db, u);
}

const DEV_COOKIE = '__Host-asalah_dev';
async function finishLogin(req, db, u) {
  const g = geo(req), kind = deviceKind(req);
  const cookie = await createSession(db, u.id, { kind, city: g.city });
  await audit(db, u, 'login');
  // جهاز ما دخل منه الحساب قبل؟ ننبّه صاحبه (إلا أول دخول للحساب)
  const m = /(?:^|;\s*)__Host-asalah_dev=([a-f0-9]{48})/.exec(req.headers.get('Cookie') || '');
  const dev = m ? m[1] : randomHex(24);
  const known = await db.prepare('INSERT INTO known_devices(user_id,dev_hash,created_at) VALUES(?,?,?) ON CONFLICT DO NOTHING').bind(u.id, await sha256(dev), now()).run();
  if (known.meta.changes && u.last_login_at) {
    const where = g.city ? ` في ${cityAr(g.city)}` : '';
    const msg = `🔐 دخول جديد لحساب ${u.name} من جهاز ${KIND_AR[kind] || 'جديد'}${where}. إذا ما هو أنت، غيّر كلمة المرور وطلّع الأجهزة من «الأمان».`;
    await db.prepare("INSERT INTO alerts(merchant_id,kind,message,created_at) VALUES(?,'new_login',?,?)").bind(u.merchant_id || null, msg, now()).run();
    await pushAlert(db, u.merchant_id || null, 'new_login', msg);
  }
  const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8' });
  headers.append('Set-Cookie', cookie);
  headers.append('Set-Cookie', `${DEV_COOKIE}=${dev}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=63072000`);
  return new Response(JSON.stringify({ ok: true, user: publicUser(u) }), { status: 200, headers });
}
const KIND_AR = { iphone: 'آيفون', ipad: 'آيباد', samsung: 'سامسونج', huawei: 'هواوي', xiaomi: 'شاومي', oppo: 'أوبو', android: 'أندرويد', windows: 'كمبيوتر ويندوز', mac: 'ماك' };

export async function login2fa(req, env) {
  sameOrigin(req);
  const db = env.DB;
  await rateLimit(db, 'login2fa:' + (await ipHash(req)), 20, 900);
  const b = await readJson(req);
  const th = await sha256(String(b.ticket || ''));
  const tk = await db.prepare('UPDATE login_tickets SET tries=tries+1 WHERE ticket_hash=? AND expires_at>? AND tries<5 RETURNING user_id').bind(th, now()).first();
  if (!tk) fail(401, 'انتهت مهلة الدخول، أدخل كلمة المرور من جديد', 'ticket_expired');
  const u = await db.prepare('SELECT u.*,m.status AS merchant_status FROM users u LEFT JOIN merchants m ON m.id=u.merchant_id WHERE u.id=?').bind(tk.user_id).first();
  if (!u || u.status !== 'active' || !u.totp_on) fail(401, 'أدخل كلمة المرور من جديد', 'ticket_expired');
  if (!(await useSecondFactor(db, u, b.code))) fail(400, 'الرمز غير صحيح، جرّب الرمز الجديد من التطبيق');
  await db.prepare('DELETE FROM login_tickets WHERE ticket_hash=?').bind(th).run();
  return finishLogin(req, db, u);
}

// رمز التطبيق، أو رمز احتياطي (كل واحد مرة وحدة)
async function useSecondFactor(db, u, raw) {
  const code = String(raw || '').replace(/[\s-]/g, '');
  const c = await checkCode(u.totp_secret, code, u.totp_last);
  if (c) return Boolean((await db.prepare('UPDATE users SET totp_last=? WHERE id=? AND totp_last<?').bind(c, u.id, c).run()).meta.changes);
  if (!/^[a-z0-9]{10}$/i.test(code)) return false;
  const list = JSON.parse(u.backup_codes || '[]');
  const h = await sha256('backup:' + code.toLowerCase());
  if (!list.includes(h)) return false;
  const left = list.filter((x) => x !== h);
  return Boolean((await db.prepare('UPDATE users SET backup_codes=? WHERE id=? AND backup_codes=?').bind(JSON.stringify(left), u.id, u.backup_codes).run()).meta.changes);
}

// ---------- الأمان: التحقق بخطوتين والأجهزة ----------
export async function security(req, env) {
  const db = env.DB;
  const u = await requireUser(db, req);
  const full = await db.prepare('SELECT totp_on,backup_codes FROM users WHERE id=?').bind(u.id).first();
  const mine = await currentTokenHash(req);
  const { results } = await db.prepare('SELECT token_hash,created_at,device_kind,city FROM sessions WHERE user_id=? AND expires_at>? ORDER BY created_at DESC LIMIT 20').bind(u.id, now()).all();
  return json({
    ok: true,
    totp_on: Boolean(full.totp_on),
    backup_left: JSON.parse(full.backup_codes || '[]').length,
    sessions: results.map((s) => ({ id: s.token_hash.slice(0, 16), created_at: s.created_at, kind: s.device_kind, device: KIND_AR[s.device_kind] || 'جهاز', city: cityAr(s.city), current: s.token_hash === mine })),
  });
}

export async function totpSetup(req, env) {
  const db = env.DB;
  const u = await requireUser(db, req);
  const full = await db.prepare('SELECT totp_on FROM users WHERE id=?').bind(u.id).first();
  if (full.totp_on) fail(409, 'التحقق بخطوتين مفعّل من قبل');
  const secret = newSecret();
  await db.prepare('UPDATE users SET totp_secret=?,totp_last=0 WHERE id=?').bind(secret, u.id).run();
  return json({ ok: true, secret, url: otpauthUrl(secret, u.email) });
}

const backupCode = () => Array.from(crypto.getRandomValues(new Uint8Array(10)), (x) => 'abcdefghjkmnpqrstuvwxyz23456789'[x % 31]).join('');
export async function totpEnable(req, env) {
  const db = env.DB;
  const u = await requireUser(db, req);
  await rateLimit(db, 'totp:' + u.id, 10, 900);
  const b = await readJson(req);
  const full = await db.prepare('SELECT * FROM users WHERE id=?').bind(u.id).first();
  if (full.totp_on) fail(409, 'التحقق بخطوتين مفعّل من قبل');
  if (!full.totp_secret) fail(400, 'ابدأ الإعداد من جديد');
  const c = await checkCode(full.totp_secret, String(b.code || '').trim());
  if (!c) fail(400, 'الرمز غير صحيح. تأكد إن وقت الجوال تلقائي وجرّب الرمز الجديد');
  const codes = Array.from({ length: 8 }, backupCode);
  const hashes = await Promise.all(codes.map((x) => sha256('backup:' + x)));
  await db.prepare('UPDATE users SET totp_on=1,totp_last=?,backup_codes=? WHERE id=?').bind(c, JSON.stringify(hashes), u.id).run();
  await audit(db, u, '2fa_enabled');
  return json({ ok: true, backup_codes: codes, message: 'تم تفعيل التحقق بخطوتين' });
}

export async function totpDisable(req, env) {
  const db = env.DB;
  const u = await requireUser(db, req);
  await rateLimit(db, 'totp:' + u.id, 10, 900);
  const b = await readJson(req);
  const full = await db.prepare('SELECT * FROM users WHERE id=?').bind(u.id).first();
  if (!full.totp_on) return json({ ok: true });
  if (!(await checkPassword(str(b.password, 'كلمة المرور', { max: 200 }), full))) fail(400, 'كلمة المرور غير صحيحة');
  if (!(await useSecondFactor(db, full, b.code))) fail(400, 'رمز التطبيق غير صحيح');
  await db.prepare('UPDATE users SET totp_on=0,totp_secret=NULL,backup_codes=NULL WHERE id=?').bind(u.id).run();
  await audit(db, u, '2fa_disabled');
  return json({ ok: true, message: 'تم إيقاف التحقق بخطوتين' });
}

// تطليع جهاز واحد، أو كل الأجهزة غير هذا
export async function endSessions(req, env) {
  const db = env.DB;
  const u = await requireUser(db, req);
  const b = await readJson(req);
  const mine = await currentTokenHash(req);
  if (b.all) await db.prepare('DELETE FROM sessions WHERE user_id=? AND token_hash<>?').bind(u.id, mine).run();
  else {
    const id = String(b.id || '');
    if (!/^[a-f0-9]{16}$/.test(id)) fail(400, 'جهاز غير معروف');
    await db.prepare("DELETE FROM sessions WHERE user_id=? AND substr(token_hash,1,16)=? AND token_hash<>?").bind(u.id, id, mine).run();
  }
  await audit(db, u, 'sessions_ended');
  return json({ ok: true, message: 'تم تسجيل الخروج من الأجهزة' });
}

export async function logout(req, env) {
  sameOrigin(req);
  return json({ ok: true }, 200, { 'Set-Cookie': await destroySession(env.DB, req) });
}

export async function me(req, env) {
  const u = await currentUser(env.DB, req);
  if (!u) fail(401, 'سجّل الدخول أولاً', 'unauthenticated');
  return json({ ok: true, user: publicUser(u), platform: env.PLATFORM_NAME || 'أصالة' });
}

export async function changePassword(req, env) {
  const db = env.DB;
  const u = await requireUser(db, req);
  const b = await readJson(req);
  const full = await db.prepare('SELECT * FROM users WHERE id=?').bind(u.id).first();
  if (!(await checkPassword(str(b.current, 'كلمة المرور الحالية', { max: 200 }), full))) fail(400, 'كلمة المرور الحالية غير صحيحة');
  const { hash, salt } = await hashPassword(validPassword(b.new_password));
  await db.batch([
    db.prepare('UPDATE users SET password_hash=?,password_salt=? WHERE id=?').bind(hash, salt, u.id),
    db.prepare('DELETE FROM sessions WHERE user_id=?').bind(u.id),
  ]);
  await audit(db, u, 'password_changed');
  return json({ ok: true, message: 'تم تغيير كلمة المرور، سجّل الدخول من جديد' }, 200, { 'Set-Cookie': await destroySession(db, req) });
}

// ---------- نسيت كلمة المرور ----------
// ما عندنا بريد صادر، فالطلب يوصل للإدارة (أو لصاحب الحساب لو موظف)، وهم يطلعون رابط إعادة لمرة وحدة.
// الرد نفسه دائماً عشان ما ينكشف إذا البريد مسجّل أو لا.
const RESET_TTL = 24 * 3600;

export async function forgotPassword(req, env) {
  sameOrigin(req);
  const db = env.DB;
  await rateLimit(db, 'forgot:' + (await ipHash(req)), 5, 3600);
  const b = await readJson(req);
  await requireHuman(env, req, b.cf_token);
  const email = str(b.email, 'البريد', { max: 200 }).toLowerCase();
  const u = await db.prepare("SELECT u.id,u.name,u.email,u.role,u.merchant_id,u.merchant_role FROM users u WHERE u.email=? AND u.status='active'").bind(email).first();
  if (u) {
    try {
      await rateLimit(db, 'forgotu:' + u.id, 2, 86400);
      const staff = u.role === 'merchant' && u.merchant_role === 'staff';
      const who = staff ? `الموظف ${u.name} (${u.email}) يطلب إعادة كلمة المرور. صاحب الحساب يقدر يغيّرها من تبويب الحساب.` : `🔑 ${u.name} (${u.email}) يطلب إعادة كلمة المرور. طلّع له رابط من الحسابات.`;
      await db.prepare("INSERT INTO alerts(merchant_id,kind,message,created_at) VALUES(?,?,?,?)").bind(staff ? u.merchant_id : null, staff ? 'staff_password' : 'password_request', who, now()).run();
      await pushAlert(db, staff ? u.merchant_id : null, staff ? 'staff_password' : 'password_request', who);
    } catch {}
  }
  return json({ ok: true, message: 'إذا البريد مسجّل عندنا، وصل طلبك لإدارة أصالة وبيوصلك رابط تغيير كلمة المرور على واتساب أو جوالك.' });
}

export async function createResetLink(db, req, target, by) {
  const token = randomHex(24);
  const t = now();
  await db.batch([
    db.prepare('UPDATE password_resets SET used_at=? WHERE user_id=? AND used_at IS NULL').bind(t, target.id),
    db.prepare('INSERT INTO password_resets(token_hash,user_id,created_by,created_at,expires_at) VALUES(?,?,?,?,?)').bind(await sha256(token), target.id, by.id, t, t + RESET_TTL),
  ]);
  return new URL(req.url).origin + '/login/?reset=' + token;
}

export async function resetPassword(req, env) {
  sameOrigin(req);
  const db = env.DB;
  await rateLimit(db, 'reset:' + (await ipHash(req)), 10, 3600);
  const b = await readJson(req);
  const token = String(b.token || '');
  if (!/^[a-f0-9]{48}$/.test(token)) fail(400, 'الرابط غير صالح');
  const r = await db.prepare('SELECT r.*,u.email FROM password_resets r JOIN users u ON u.id=r.user_id WHERE r.token_hash=?').bind(await sha256(token)).first();
  if (!r || r.used_at || r.expires_at < now()) fail(400, 'الرابط انتهى أو استُخدم. اطلب رابط جديد');
  if (b.check) return json({ ok: true, email: r.email });
  const { hash, salt } = await hashPassword(validPassword(b.password));
  await db.batch([
    db.prepare('UPDATE users SET password_hash=?,password_salt=? WHERE id=?').bind(hash, salt, r.user_id),
    db.prepare('UPDATE password_resets SET used_at=? WHERE token_hash=?').bind(now(), r.token_hash),
    db.prepare('DELETE FROM sessions WHERE user_id=?').bind(r.user_id),
  ]);
  await audit(db, { id: r.user_id }, 'password_reset_done');
  return json({ ok: true, message: 'تم تغيير كلمة المرور، سجّل دخولك الحين' });
}

// يشتغل مرة وحدة: لما ما فيه أي مدير عام. ولو انضاف SETUP_TOKEN لازم يطابقه
export async function setup(req, env) {
  sameOrigin(req);
  const db = env.DB;
  await rateLimit(db, 'setup:' + (await ipHash(req)), 5, 3600);
  const existing = await db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin'").first();
  if (existing.n > 0) fail(409, 'تم إعداد النظام مسبقاً');
  const b = await readJson(req);
  if (env.SETUP_TOKEN && !safeEqual(String(b.token ?? ''), env.SETUP_TOKEN)) fail(401, 'مفتاح الإعداد غير صحيح');
  const email = str(b.email, 'البريد', { max: 200 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'البريد غير صحيح');
  const { hash, salt } = await hashPassword(validPassword(b.password));
  const row = await db
    .prepare("INSERT INTO users(email,name,role,password_hash,password_salt,created_at) VALUES(?,?,'admin',?,?,?) RETURNING id")
    .bind(email, str(b.name, 'الاسم', { max: 100 }), hash, salt, now())
    .first();
  await audit(db, { id: row.id }, 'setup_admin_created');
  return json({ ok: true, message: 'تم إنشاء حساب المدير العام، سجّل الدخول الآن' });
}
