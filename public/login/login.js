import { api, onSubmit, toast } from '/assets/common.js';

const home = (role) => (role === 'admin' ? '/admin/' : '/merchant/');
const login = document.getElementById('login');
const setup = document.getElementById('setup');

if (new URLSearchParams(location.search).has('setup')) {
  login.hidden = true;
  setup.hidden = false;
}

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

onSubmit(login, async (f, form) => {
  if (!form.reportValidity()) return;
  const d = await scanning(form, 'جاري التحقق…', () => api('/api/auth/login', { method: 'POST', body: f }));
  verified(form, '✓ تم التحقق');
  setTimeout(() => (location.href = home(d.user.role)), 650);
});

onSubmit(setup, async (f, form) => {
  if (!form.reportValidity()) return;
  const d = await scanning(form, 'جاري الإنشاء…', () => api('/api/setup', { method: 'POST', body: f }));
  toast(d.message);
  form.reset();
  setup.hidden = true;
  login.hidden = false;
});
