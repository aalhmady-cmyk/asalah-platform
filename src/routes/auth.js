// الدخول والخروج وتغيير كلمة المرور، وإنشاء أول مدير عام.
import { checkPassword, createSession, currentUser, destroySession, hashPassword, requireUser, sameOrigin, validPassword } from '../lib/auth.js';
import { audit, fail, ipHash, json, now, randomHex, rateLimit, readJson, safeEqual, sha256, str } from '../lib/util.js';

const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name, role: u.role, merchant_id: u.merchant_id, merchant_role: u.role === 'merchant' ? u.merchant_role || 'owner' : null });

export async function login(req, env) {
  sameOrigin(req);
  const db = env.DB;
  await rateLimit(db, 'login:' + (await ipHash(req)), 10, 900);
  const b = await readJson(req);
  const email = str(b.email, 'البريد', { max: 200 }).toLowerCase();
  const password = str(b.password, 'كلمة المرور', { max: 200 });
  const u = await db
    .prepare('SELECT u.*,m.status AS merchant_status FROM users u LEFT JOIN merchants m ON m.id=u.merchant_id WHERE u.email=?')
    .bind(email)
    .first();
  // نحسب الـ hash حتى لو الحساب غير موجود، عشان ما ينكشف وجوده من زمن الرد
  const ok = u ? await checkPassword(password, u) : (await hashPassword(password), false);
  if (!ok) fail(401, 'البريد أو كلمة المرور غير صحيحة');
  if (u.status !== 'active') fail(403, 'هذا الحساب موقوف');
  if (u.role === 'merchant' && u.merchant_status !== 'active') fail(403, 'حساب التاجر موقوف، تواصل مع إدارة أصالة');
  const cookie = await createSession(db, u.id);
  await audit(db, u, 'login');
  return json({ ok: true, user: publicUser(u) }, 200, { 'Set-Cookie': cookie });
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
  const email = str(b.email, 'البريد', { max: 200 }).toLowerCase();
  const u = await db.prepare("SELECT u.id,u.name,u.email,u.role,u.merchant_id,u.merchant_role FROM users u WHERE u.email=? AND u.status='active'").bind(email).first();
  if (u) {
    try {
      await rateLimit(db, 'forgotu:' + u.id, 2, 86400);
      const staff = u.role === 'merchant' && u.merchant_role === 'staff';
      const who = staff ? `الموظف ${u.name} (${u.email}) يطلب إعادة كلمة المرور. صاحب الحساب يقدر يغيّرها من تبويب الحساب.` : `🔑 ${u.name} (${u.email}) يطلب إعادة كلمة المرور. طلّع له رابط من الحسابات.`;
      await db.prepare("INSERT INTO alerts(merchant_id,kind,message,created_at) VALUES(?,?,?,?)").bind(staff ? u.merchant_id : null, staff ? 'staff_password' : 'password_request', who, now()).run();
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
