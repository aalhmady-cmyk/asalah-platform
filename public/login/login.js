import { api, onSubmit, toast } from '/assets/common.js';

const home = (role) => (role === 'admin' ? '/admin/' : '/merchant/');
const login = document.getElementById('login');
const setup = document.getElementById('setup');

const forgot = document.getElementById('forgot');
const reset = document.getElementById('reset');
const qs = new URLSearchParams(location.search);
const showForm = (f) => { for (const x of [login, setup, forgot, reset, document.getElementById('otp')]) x.hidden = x !== f; };
if (qs.has('setup')) showForm(setup);
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-show]');
  if (b) showForm(document.getElementById(b.dataset.show));
});

// رابط إعادة كلمة المرور: نتأكد إنه صالح ونعرض البريد
const resetToken = qs.get('reset');
if (resetToken) {
  showForm(reset);
  api('/api/auth/reset', { method: 'POST', body: { token: resetToken, check: true } })
    .then((d) => (document.getElementById('reset-for').textContent = `اختر كلمة مرور جديدة لحساب ${d.email}`))
    .catch((e) => { toast(e.message, true); showForm(forgot); });
}
onSubmit(forgot, async (f, form) => {
  if (!form.reportValidity()) return;
  const d = await scanning(form, 'نرسل…', () => api('/api/auth/forgot', { method: 'POST', body: { email: f.email } }));
  const done = document.getElementById('forgot-done');
  done.textContent = d.message;
  done.hidden = false;
});
onSubmit(reset, async (f, form) => {
  if (!form.reportValidity()) return;
  if (f.password !== f.confirm) return toast('كلمتين المرور مو نفس بعض', true);
  const d = await scanning(form, 'نحفظ…', () => api('/api/auth/reset', { method: 'POST', body: { token: resetToken, password: f.password } }));
  toast(d.message);
  history.replaceState(null, '', '/login/');
  form.reset();
  showForm(login);
});

api('/api/auth/me').then((d) => (location.href = home(d.user.role))).catch(() => {});

document.querySelector('[data-eye]').addEventListener('click', (e) => {
  const btn = e.currentTarget;
  const input = btn.parentElement.querySelector('input');
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  btn.setAttribute('aria-pressed', String(show));
  btn.setAttribute('aria-label', show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور');
});

// الزر يمسح أثناء الطلب، وعند النجاح يتحوّل لختم ذهبي قبل الانتقال
async function scanning(form, label, fn) {
  const btn = form.querySelector('.scan-btn');
  const text = btn.querySelector('.scan-label');
  const original = text.textContent;
  btn.classList.add('is-scanning');
  text.textContent = label;
  try {
    return await fn();
  } finally {
    btn.classList.remove('is-scanning');
    if (!btn.classList.contains('is-ok')) text.textContent = original;
  }
}
function verified(form, label) {
  const btn = form.querySelector('.scan-btn');
  btn.classList.add('is-ok');
  btn.querySelector('.scan-label').textContent = label;
}

let ticket = null;
const otp = document.getElementById('otp');
onSubmit(login, async (f, form) => {
  if (!form.reportValidity()) return;
  const d = await scanning(form, 'جاري التحقق…', () => api('/api/auth/login', { method: 'POST', body: f }));
  // الحساب عليه تحقق بخطوتين: نطلب رمز التطبيق
  if (d.need_2fa) {
    ticket = d.ticket;
    login.hidden = true;
    otp.hidden = false;
    otp.code.value = '';
    otp.code.focus();
    return;
  }
  verified(form, '✓ تم التحقق');
  setTimeout(() => (location.href = home(d.user.role)), 650);
});

onSubmit(otp, async (f, form) => {
  if (!form.reportValidity()) return;
  try {
    const d = await scanning(form, 'جاري التحقق…', () => api('/api/auth/login/2fa', { method: 'POST', body: { ticket, code: f.code.trim() } }));
    verified(form, '✓ تم التحقق');
    setTimeout(() => (location.href = home(d.user.role)), 650);
  } catch (e) {
    if (e.data?.code === 'ticket_expired') { otp.hidden = true; login.hidden = false; }
    throw e;
  }
});

onSubmit(setup, async (f, form) => {
  if (!form.reportValidity()) return;
  const d = await scanning(form, 'جاري الإنشاء…', () => api('/api/setup', { method: 'POST', body: f }));
  toast(d.message);
  form.reset();
  setup.hidden = true;
  login.hidden = false;
});
