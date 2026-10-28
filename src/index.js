// أصالة المنتجات الأصلية: نقطة الدخول.
import { runAlerts } from './lib/alerts.js';
import { serveImage } from './lib/images.js';
import { prepare } from './lib/schema.js';
import { HttpError, json } from './lib/util.js';
import { handleAdmin } from './routes/admin.js';
import { changePassword, login, logout, me, setup } from './routes/auth.js';
import { handleMerchant } from './routes/merchant.js';
import { handlePublicStore } from './routes/store.js';
import { serveMedia } from './lib/store.js';
import { brandPage, brands, enter, guideChat, guideInfo, joinRequest, shopAiRoute, stats, loyaltyClaim, loyaltyRedeem, loyaltyWallet, rate, report, verify } from './routes/public.js';

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
};

async function route(req, env) {
  const path = new URL(req.url).pathname;
  const m = req.method;
  if (!env.DB) return json({ ok: false, message: 'قاعدة البيانات غير مرتبطة باسم DB' }, 503);
  env = await prepare(env);
  if (path.startsWith('/img/') && (m === 'GET' || m === 'HEAD')) return serveImage(env, path);
  if (path.startsWith('/media/') && (m === 'GET' || m === 'HEAD')) return serveMedia(req, env, path);
  if (path === '/api/public/store' || path.startsWith('/api/public/store/')) return handlePublicStore(req, env, path);
  if (path === '/api/verify' && m === 'POST') return verify(req, env);
  if (path === '/api/loyalty/claim' && m === 'POST') return loyaltyClaim(req, env);
  if (path === '/api/loyalty/wallet' && m === 'POST') return loyaltyWallet(req, env);
  if (path === '/api/loyalty/redeem' && m === 'POST') return loyaltyRedeem(req, env);
  if (path === '/api/rate' && m === 'POST') return rate(req, env);
  if (path === '/api/public/brands' && m === 'GET') return brands(env);
  if (path === '/api/public/stats' && m === 'GET') return stats(env);
  if (path === '/api/public/join' && m === 'POST') return joinRequest(req, env);
  if (path === '/api/public/shop-ai' && (m === 'GET' || m === 'POST')) return shopAiRoute(req, env);
  if (path === '/api/public/assistant' && m === 'GET') return guideInfo(env);
  if (path === '/api/public/assistant' && m === 'POST') return guideChat(req, env);
  const bm = path.match(/^\/api\/public\/brands\/([a-z0-9-]{2,40})$/);
  if (bm && m === 'GET') return brandPage(env, bm[1]);
  if (path === '/api/enter' && m === 'POST') return enter(req, env);
  if (path === '/api/report' && m === 'POST') return report(req, env);
  if (path === '/api/auth/login' && m === 'POST') return login(req, env);
  if (path === '/api/auth/logout' && m === 'POST') return logout(req, env);
  if (path === '/api/auth/me' && m === 'GET') return me(req, env);
  if (path === '/api/auth/password' && m === 'POST') return changePassword(req, env);
  if (path === '/api/setup' && m === 'POST') return setup(req, env);
  if (path.startsWith('/api/admin/')) return handleAdmin(req, env, path);
  if (path.startsWith('/api/m/')) return handleMerchant(req, env, path);
  return json({ ok: false, message: 'المسار غير موجود' }, 404);
}

export default {
  async fetch(req, env) {
    let res;
    try {
      res = await route(req, env);
    } catch (e) {
      if (e instanceof HttpError) res = json({ ok: false, message: e.message, code: e.code }, e.status);
      else {
        console.error('ASALAH_ERROR', e?.stack || e);
        res = json({ ok: false, message: 'صار خطأ في الخادم، حاول مرة ثانية' }, 500);
      }
    }
    const out = new Response(res.body, res);
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) out.headers.set(k, v);
    return out;
  },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(prepare(env).then(runAlerts));
  },
};
