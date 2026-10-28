// الدخول والخروج وتغيير كلمة المرور، وإنشاء أول مدير عام.
import { checkPassword, createSession, currentUser, destroySession, hashPassword, requireUser, sameOrigin, validPassword } from '../lib/auth.js';
import { audit, fail, ipHash, json, now, rateLimit, readJson, safeEqual, str } from '../lib/util.js';

const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name, role: u.role, merchant_id: u.merchant_id });

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
