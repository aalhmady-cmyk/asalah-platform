// نوافذ تأكيد وإدخال بتصميم المنصة بدل confirm/prompt حقّت المتصفح
const STYLE = `
.adlg{border:0;border-radius:18px;padding:0;width:min(420px,calc(100vw - 32px));color:var(--ink,#0F2A21);background:var(--card,#fff);box-shadow:0 24px 60px rgba(15,42,33,.25)}
.adlg::backdrop{background:rgba(15,42,33,.45);backdrop-filter:blur(2px)}
.adlg form{padding:22px;display:flex;flex-direction:column;gap:14px}
.adlg h3{margin:0;font-size:18px}
.adlg p{margin:0;color:var(--muted,#5b6b64);line-height:1.7;white-space:pre-line}
.adlg input,.adlg textarea{width:100%;box-sizing:border-box;padding:11px 12px;border:1px solid var(--line,#dfe6e2);border-radius:12px;font:inherit;background:transparent;color:inherit}
.adlg .adlg-act{display:flex;gap:10px;justify-content:flex-start;flex-wrap:wrap}
.adlg .adlg-ic{width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:22px;background:var(--green-tint,#E6F2EC)}
.adlg.danger .adlg-ic{background:#FDECEA}
.adlg .btn-danger{background:#B42318;color:#fff;border-color:#B42318}`;

let styled = false;
function open({ title, message, icon, ok = 'تمام', cancel = 'إلغاء', danger = false, fields = [] }) {
  if (!styled) { const s = document.createElement('style'); s.textContent = STYLE; document.head.append(s); styled = true; }
  return new Promise((resolve) => {
    const d = document.createElement('dialog');
    d.className = 'adlg' + (danger ? ' danger' : '');
    const f = document.createElement('form');
    f.method = 'dialog';
    const head = document.createElement('div');
    head.style.cssText = 'display:flex;gap:12px;align-items:center';
    const ic = document.createElement('span');
    ic.className = 'adlg-ic';
    ic.textContent = icon || (danger ? '⚠️' : 'ℹ️');
    const h = document.createElement('h3');
    h.textContent = title || 'تأكيد';
    head.append(ic, h);
    f.append(head);
    if (message) { const p = document.createElement('p'); p.textContent = message; f.append(p); }
    const inputs = fields.map((x) => {
      const i = document.createElement(x.multiline ? 'textarea' : 'input');
      if (!x.multiline) i.type = x.type || 'text';
      i.name = x.name;
      i.placeholder = x.placeholder || '';
      i.value = x.value ?? '';
      if (x.required) i.required = true;
      if (x.ltr) i.dir = 'ltr';
      if (x.inputmode) i.inputMode = x.inputmode;
      if (x.label) { const l = document.createElement('label'); l.className = 'field'; l.append(x.label, i); f.append(l); } else f.append(i);
      return i;
    });
    const act = document.createElement('div');
    act.className = 'adlg-act';
    const yes = document.createElement('button');
    yes.className = 'btn ' + (danger ? 'btn-danger' : 'btn-primary');
    yes.value = 'ok';
    yes.textContent = ok;
    act.append(yes);
    if (cancel) {
      const no = document.createElement('button');
      no.type = 'button';
      no.className = 'btn';
      no.textContent = cancel;
      no.addEventListener('click', () => d.close('cancel'));
      act.append(no);
    }
    f.append(act);
    d.append(f);
    document.body.append(d);
    d.addEventListener('close', () => {
      const okd = d.returnValue === 'ok';
      resolve(fields.length ? (okd ? Object.fromEntries(inputs.map((i) => [i.name, i.value])) : null) : okd);
      d.remove();
    });
    d.showModal();
    (inputs[0] || yes).focus();
  });
}

// تأكيد: يرجع true أو false
export const confirmBox = (message, opts = {}) => open({ message, ...opts });
// إدخال قيمة وحدة: يرجع النص أو null
export async function promptBox(message, opts = {}) {
  const r = await open({ message, ...opts, fields: [{ name: 'v', value: opts.value, placeholder: opts.placeholder, type: opts.type, ltr: opts.ltr, multiline: opts.multiline, inputmode: opts.inputmode, required: opts.required }] });
  return r ? r.v : null;
}
// نموذج بأكثر من خانة: يرجع كائن بالقيم أو null
export const formBox = (opts) => open(opts);
// رسالة بزر واحد
export const alertBox = (message, opts = {}) => open({ message, cancel: null, ...opts });
