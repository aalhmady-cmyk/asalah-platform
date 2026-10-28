import { api, onSubmit, toast } from '/assets/common.js';

const home = (role) => (role === 'admin' ? '/admin/' : '/merchant/');
const login = document.getElementById('login');
const setup = document.getElementById('setup');

if (new URLSearchParams(location.search).has('setup')) {
  login.hidden = true;
  setup.hidden = false;
}

api('/api/auth/me').then((d) => (location.href = home(d.user.role))).catch(() => {});

onSubmit(login, async (f) => {
  const d = await api('/api/auth/login', { method: 'POST', body: f });
  location.href = home(d.user.role);
});

onSubmit(setup, async (f, form) => {
  const d = await api('/api/setup', { method: 'POST', body: f });
  toast(d.message);
  form.reset();
  setup.hidden = true;
  login.hidden = false;
});
