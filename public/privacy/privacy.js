import { api, onSubmit, toast } from '/assets/common.js';
import { humanToken } from '/assets/human.js';

const form = document.getElementById('privacy-form');
onSubmit(form, async (f) => {
  if (!form.reportValidity()) return;
  const d = await api('/api/public/privacy', { method: 'POST', body: { phone: f.phone, note: f.note || null, cf_token: await humanToken() } });
  const done = document.getElementById('privacy-done');
  done.textContent = d.message;
  done.hidden = false;
  form.reset();
  toast('وصلنا طلبك ✅');
});
