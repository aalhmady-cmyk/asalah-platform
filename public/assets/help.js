// زر «؟» جنب عنوان كل قسم: شرح قصير وش يسوي القسم وكيف تستفيد منه
import { alertBox } from '/assets/dialog.js';

const STYLE = '.help-q{margin-inline-start:10px;width:28px;height:28px;border-radius:50%;border:1px solid var(--line);background:var(--surface);color:var(--muted);font:inherit;font-size:15px;font-weight:700;cursor:pointer;vertical-align:middle;line-height:1}.help-q:hover{color:var(--green);border-color:var(--green)}';

export function mountHelp(texts) {
  const s = document.createElement('style');
  s.textContent = STYLE;
  document.head.append(s);
  const main = document.querySelector('.main');
  const add = () => {
    for (const sec of main.querySelectorAll(':scope > section')) {
      const text = texts[sec.id];
      const h = sec.querySelector('.page-head h1');
      if (!text || !h || h.querySelector('.help-q')) continue;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'help-q';
      b.textContent = '؟';
      b.setAttribute('aria-label', 'وش هذا القسم؟');
      b.addEventListener('click', () => alertBox(text, { title: h.firstChild.textContent.trim(), icon: '💡', ok: 'فهمت' }));
      h.append(b);
    }
  };
  new MutationObserver(add).observe(main, { childList: true, subtree: true });
  add();
}
