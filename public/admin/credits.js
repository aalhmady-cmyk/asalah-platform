// تبويب "نقاط المساعد" في اللوحة الأم: النقاط المجانية والباقات وأسعارها، رصيد كل تاجر، وطلبات الشحن.
import { api, html, num, render, toast, when } from '/assets/common.js';
import { promptBox } from '/assets/dialog.js';

const $ = (id) => document.getElementById(id);
let D = null;

export async function creditsBadge() {
  try {
    const d = await api('/api/admin/ai-credits');
    $('credits-badge').textContent = d.requests.filter((r) => !r.read_at).length || '';
  } catch { /* لاحقاً */ }
}

export async function loadCredits() {
  D = await api('/api/admin/ai-credits');
  const open = D.requests.filter((r) => !r.read_at);
  $('credits-badge').textContent = open.length || '';
  const cost = D.used * D.plan.cost;
  render($('credits'), html`
    <div class="page-head"><div><h1>نقاط المساعد ✨</h1><p>كل رد من الذكاء الاصطناعي في "متجري الخاص" يخصم نقطة من التاجر. الأزرار مجانية وما تكلفك شي.</p></div></div>
    ${D.ai_enabled ? '' : html`<p class="tip warn" style="margin-top:16px">مفتاح الذكاء الاصطناعي غير مضاف، فالتجار يقدرون يستخدمون البوت المجاني بس.</p>`}
    <div class="kpis" style="margin-top:24px">
      <div class="kpi"><span class="label">ردود الذكاء المستخدمة</span><span class="value">${num(D.used)}</span></div>
      <div class="kpi"><span class="label">تكلفة المفتاح التقديرية</span><span class="value">${num(Math.round(cost * 100) / 100)} ر.س</span><span class="note">${D.plan.cost} ر.س لكل رد (تقدير تعدّله تحت)</span></div>
      <div class="kpi"><span class="label">طلبات شحن مفتوحة</span><span class="value">${num(open.length)}</span></div>
      <div class="kpi"><span class="label">متاجر خاصة منشورة</span><span class="value">${num(D.merchants.filter((m) => m.published_at).length)}</span></div>
    </div>
    ${open.length ? html`<div class="card" style="margin-top:24px"><h2>📥 طلبات شحن النقاط</h2><div class="table-wrap"><table><thead><tr><th>التاجر</th><th>الطلب</th><th>متى</th><th></th></tr></thead><tbody>${open.map((r) => html`<tr><td>${r.merchant_name}</td><td>${r.message}</td><td>${when(r.created_at)}</td><td><button type="button" class="btn btn-sm btn-gold" data-req="${r.id}" data-mid="${r.merchant_id}" data-pts="${(r.message.match(/شحن (\d+)/) || [])[1] || ''}">أضف النقاط</button> <button type="button" class="btn btn-sm" data-dismiss="${r.id}" data-mid="${r.merchant_id}">تجاهل</button></td></tr>`)}</tbody></table></div></div>` : ''}
    <div class="row" style="margin-top:24px">
      <form class="card" id="cr-plan">
        <h2>الباقات والأسعار</h2>
        <div class="form-grid">
          <label class="field">نقاط مجانية لكل تاجر جديد<input name="free" type="number" min="0" max="1000" class="ltr" value="${D.plan.free}"></label>
          <label class="field">تكلفة الرد التقديرية (ريال)<input name="cost" type="number" min="0" max="10" step="0.01" class="ltr" value="${D.plan.cost}"><small class="muted">من فاتورة Anthropic ÷ عدد الردود</small></label>
        </div>
        <div id="cr-packs" style="display:flex;flex-direction:column;gap:8px">${D.plan.packs.map(packRow)}</div>
        <div class="actions"><button type="button" class="btn btn-sm" id="cr-add-pack">➕ باقة</button><button class="btn btn-primary" type="submit">حفظ</button></div>
        <p class="small muted" style="margin:0" id="cr-margin"></p>
      </form>
      <div class="card wide"><h2>رصيد التجار</h2><div class="table-wrap"><table><thead><tr><th>التاجر</th><th>الرصيد</th><th>المستخدم</th><th>المتجر الخاص</th><th>الطلبات</th><th></th></tr></thead><tbody>
        ${D.merchants.map((m) => html`<tr><td>${m.name}</td><td><b>${m.ai_free_given ? num(m.ai_credits) : html`<span class="muted">${D.plan.free} (لم يبدأ)</span>`}</b></td><td>${num(m.ai_used)}</td><td>${m.published_at ? html`<span class="pill ok">منشور</span>` : html`<span class="pill">لا</span>`}</td><td>${num(m.orders)}</td><td><button type="button" class="btn btn-sm" data-add="${m.id}">± نقاط</button></td></tr>`)}
        ${D.merchants.length ? '' : html`<tr><td colspan="6" class="muted">ما فيه تجار مفعّل لهم متاجر أصالة</td></tr>`}
      </tbody></table></div></div>
    </div>`);
  margin();
  const plan = $('cr-plan');
  plan.addEventListener('input', margin);
  $('cr-add-pack').onclick = () => {
    const tmp = document.createElement('div');
    render(tmp, packRow({ points: 100, price: 49 }));
    $('cr-packs').append(...tmp.children);
    margin();
  };
  $('cr-packs').onclick = (e) => { const b = e.target.closest('[data-del-pack]'); if (b) { b.closest('.cr-pack').remove(); margin(); } };
  plan.onsubmit = async (e) => {
    e.preventDefault();
    const packs = [...plan.querySelectorAll('.cr-pack')].map((r) => ({ points: Number(r.querySelector('[name=points]').value), price: Number(r.querySelector('[name=price]').value) }));
    try { await api('/api/admin/ai-credits/plan', { method: 'PUT', body: { free: Number(plan.free.value), cost: Number(plan.cost.value), packs } }); toast('تم الحفظ'); loadCredits(); } catch (err) { toast(err.message, true); }
  };
  $('credits').onclick = async (e) => {
    const add = e.target.closest('[data-add]');
    const req = e.target.closest('[data-req]');
    const dis = e.target.closest('[data-dismiss]');
    if (add || req) {
      const v = await promptBox(req ? 'كم نقطة تضيف؟ (بعد ما يدفع التاجر)' : 'كم نقطة؟ (رقم سالب للخصم)', req?.dataset.pts || '50');
      const delta = Math.round(Number(v));
      if (!v || !delta) return;
      try {
        const d = await api('/api/admin/ai-credits/' + (add || req).dataset[add ? 'add' : 'mid'], { method: 'POST', body: { delta, request_id: req ? Number(req.dataset.req) : undefined } });
        toast(`تم. رصيده الحين ${d.balance}`);
        loadCredits();
      } catch (err) { toast(err.message, true); }
    }
    if (dis) {
      try { await api(`/api/admin/ai-credits/requests/${dis.dataset.dismiss}/dismiss`, { method: 'POST' }); loadCredits(); } catch (err) { toast(err.message, true); }
    }
  };
}

function packRow(p) {
  return html`<div class="cr-pack form-grid" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto;align-items:end"><label class="field">النقاط<input name="points" type="number" min="1" class="ltr" value="${p.points ?? ''}"></label><label class="field">السعر (ريال)<input name="price" type="number" min="0" step="0.01" class="ltr" value="${p.price ?? ''}"></label><button type="button" class="btn btn-sm btn-danger" data-del-pack aria-label="حذف">✕</button></div>`;
}

// يوضح للمدير ربحه من كل باقة مقابل تكلفة المفتاح
function margin() {
  const plan = $('cr-plan');
  if (!plan) return;
  const cost = Number(plan.cost.value) || 0;
  const rows = [...plan.querySelectorAll('.cr-pack')].map((r) => {
    const pts = Number(r.querySelector('[name=points]').value) || 0;
    const price = Number(r.querySelector('[name=price]').value) || 0;
    return `${pts} نقطة: تكلفتك ≈ ${(pts * cost).toFixed(1)} ر.س، ربحك ≈ ${(price - pts * cost).toFixed(1)} ر.س`;
  });
  $('cr-margin').textContent = rows.join(' · ');
}
