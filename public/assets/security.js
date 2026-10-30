// بطاقة «الأمان» في اللوحتين: التحقق بخطوتين، والأجهزة المسجّل منها الدخول
import { api, html, render, toast, when } from '/assets/common.js';
import { confirmBox, formBox } from '/assets/dialog.js';
import qrcode from '/assets/vendor/qrcode.mjs';

const ICON = { iphone: '📱', ipad: '📱', samsung: '📱', huawei: '📱', xiaomi: '📱', oppo: '📱', android: '📱', windows: '💻', mac: '💻' };

function qrSvg(text) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 2 });
}

export async function mountSecurity(box) {
  const d = await api('/api/auth/security');
  render(box, html`
    <div class="card sec-card">
      <h2>التحقق بخطوتين 🔐</h2>
      ${d.totp_on
        ? html`<div class="alert info"><div>مفعّل. كل دخول يحتاج كلمة المرور + رمز من تطبيق المصادقة في جوالك. باقي عندك ${d.backup_left} رموز احتياطية.</div></div>
               <div><button class="btn" type="button" data-sec="off">إيقاف التحقق بخطوتين</button></div>`
        : html`<p class="muted">حتى لو أحد عرف كلمة مرورك، ما يقدر يدخل بدون الرمز اللي يطلع في جوالك. تحتاج تطبيق مجاني مثل Google Authenticator أو Microsoft Authenticator.</p>
               <div id="sec-setup"><button class="btn btn-primary" type="button" data-sec="setup">فعّل التحقق بخطوتين</button></div>`}
    </div>
    <div class="card sec-card" style="margin-top:16px">
      <h2>الأجهزة المسجّل منها الدخول</h2>
      <p class="muted small">إذا شفت جهاز ما تعرفه، طلّعه وغيّر كلمة المرور.</p>
      <ul class="sec-list">
        ${d.sessions.map((s) => html`<li>
          <span class="sec-ic">${ICON[s.kind] || '🖥️'}</span>
          <div><b>${s.device}${s.current ? html` <span class="pill ok">هذا الجهاز</span>` : ''}</b><small>${s.city ? s.city + ' · ' : ''}دخل ${when(s.created_at)}</small></div>
          ${s.current ? '' : html`<button class="btn small" type="button" data-end="${s.id}">تسجيل خروج</button>`}
        </li>`)}
      </ul>
      ${d.sessions.length > 1 ? html`<div><button class="btn" type="button" data-sec="all">تسجيل الخروج من كل الأجهزة الثانية</button></div>` : ''}
    </div>`);

  box.querySelector('[data-sec="setup"]')?.addEventListener('click', async () => {
    try {
      const s = await api('/api/auth/2fa/setup', { method: 'POST', body: {} });
      render(box.querySelector('#sec-setup'), html`
        <ol class="sec-steps">
          <li>افتح تطبيق المصادقة واضغط «إضافة» ثم «مسح رمز QR».</li>
          <li>امسح هذا الرمز:<div class="sec-qr"></div><small class="muted">ما تقدر تمسح؟ أدخل هذا المفتاح يدوياً: <code class="ltr">${s.secret.replace(/(.{4})/g, '$1 ').trim()}</code></small></li>
          <li>اكتب الرمز اللي ظهر في التطبيق (6 أرقام):</li>
        </ol>
        <form id="sec-enable" class="sec-row"><input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="\\d{6}" required class="ltr" placeholder="123456"><button class="btn btn-primary" type="submit">تفعيل</button></form>`);
      box.querySelector('.sec-qr').innerHTML = qrSvg(s.url);
      box.querySelector('#sec-enable').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          const r = await api('/api/auth/2fa/enable', { method: 'POST', body: { code: e.target.code.value.trim() } });
          toast(r.message);
          render(box.querySelector('#sec-setup'), html`
            <div class="alert warn"><div><b>احفظ هذي الرموز الاحتياطية في مكان آمن.</b> لو ضاع جوالك تدخل بواحد منها (كل رمز مرة وحدة). ما راح تظهر مرة ثانية.</div></div>
            <pre class="sec-codes ltr">${r.backup_codes.join('\n')}</pre>
            <div class="actions"><button class="btn" type="button" id="sec-copy">نسخ الرموز</button><button class="btn btn-primary" type="button" id="sec-done">حفظتها</button></div>`);
          box.querySelector('#sec-copy').addEventListener('click', () => navigator.clipboard?.writeText(r.backup_codes.join('\n')).then(() => toast('تم النسخ')));
          box.querySelector('#sec-done').addEventListener('click', () => mountSecurity(box));
        } catch (err) { toast(err.message, true); }
      });
    } catch (err) { toast(err.message, true); }
  });

  box.querySelector('[data-sec="off"]')?.addEventListener('click', async () => {
    const f = await formBox({ title: 'إيقاف التحقق بخطوتين', message: 'حسابك بيصير محمي بكلمة المرور بس.', danger: true, ok: 'إيقاف', fields: [
      { name: 'password', type: 'password', label: 'كلمة المرور', required: true, ltr: true },
      { name: 'code', label: 'رمز التطبيق أو رمز احتياطي', required: true, ltr: true, inputmode: 'numeric' },
    ] });
    if (!f) return;
    try { toast((await api('/api/auth/2fa/disable', { method: 'POST', body: f })).message); mountSecurity(box); } catch (err) { toast(err.message, true); }
  });

  const end = async (body) => {
    try { toast((await api('/api/auth/sessions/end', { method: 'POST', body })).message); mountSecurity(box); } catch (err) { toast(err.message, true); }
  };
  for (const b of box.querySelectorAll('[data-end]')) b.addEventListener('click', () => end({ id: b.dataset.end }));
  box.querySelector('[data-sec="all"]')?.addEventListener('click', async () => {
    if (await confirmBox('بنسجّل خروج كل الأجهزة غير هذا الجهاز.', { title: 'تسجيل خروج الأجهزة', ok: 'سجّل خروجها', danger: true })) end({ all: true });
  });
}
