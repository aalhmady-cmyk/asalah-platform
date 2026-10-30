// أصالة المنتجات الأصلية: نقطة الدخول.
import { runAlerts } from './lib/alerts.js';
import { notifyMerchants } from './lib/notify.js';
import { runStoreSync } from './lib/sync.js';
import { serveImage } from './lib/images.js';
import { prepare } from './lib/schema.js';
import { HttpError, json } from './lib/util.js';
import { handleAdmin } from './routes/admin.js';
import { runBackup } from './lib/backup.js';
import { changePassword, endSessions, forgotPassword, login, login2fa, logout, me, resetPassword, security, setup, totpDisable, totpEnable, totpSetup } from './routes/auth.js';
import { handleMerchant } from './routes/merchant.js';
import { handleSeo } from './routes/seo.js';
import { handlePublicPush, handleUserPush } from './routes/push.js';
import { runCampaigns } from './lib/push.js';
import { runWeekly } from './lib/trust.js';
import { handlePublicTrust } from './routes/trust.js';
import { handlePublicGrowth } from './routes/growth.js';
import { runMonthly } from './lib/growth.js';
import { handlePublicStore } from './routes/store.js';
import { handlePublicSite, serveSitePage } from './routes/site.js';
import { handleCustomer } from './lib/customers.js';
import { serveMedia } from './lib/store.js';
import { brandPage, brands, enter, guideChat, guideInfo, joinRequest, shopAiRoute, stats, loyaltyClaim, loyaltyRedeem, loyaltyWallet, rate, report, verify, guarantee, humanConfig } from './routes/public.js';

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  // المتصفح يفتح الموقع دائماً بـ https حتى لو انكتب الرابط بدونها
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

const SITE_CSP = "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' https: data: blob:; media-src 'self' blob:; connect-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'self'";

async function route(req, env) {
  const path = new URL(req.url).pathname;
  const m = req.method;
  if (!env.DB) return json({ ok: false, message: 'قاعدة البيانات غير مرتبطة باسم DB' }, 503);
  env = await prepare(env);
  if (path.startsWith('/img/') && (m === 'GET' || m === 'HEAD')) return serveImage(env, path);
  if (path.startsWith('/media/') && (m === 'GET' || m === 'HEAD')) return serveMedia(req, env, path);
  // صفحة الدخول داخل نطاق تطبيق لوحة التاجر (نفس صفحة /login/)
  if ((m === 'GET' || m === 'HEAD') && /^\/(merchant|admin)\/login\/?$/.test(path)) {
    const u = new URL(req.url);
    u.pathname = '/login/';
    return env.ASSETS.fetch(new Request(u, req));
  }
  if ((m === 'GET' || m === 'HEAD') && (path === '/robots.txt' || path === '/sitemap.xml' || path.startsWith('/stores/p/') || path.startsWith('/stores/m/'))) {
    const r = await handleSeo(req, env, path);
    if (r) return r;
  }
  if (path.startsWith('/s/') && (m === 'GET' || m === 'HEAD')) {
    return (await serveSitePage(req, env, path)) || env.ASSETS.fetch(req);
  }
  if (path.startsWith('/api/public/site/') || path.startsWith('/api/public/site-order/')) return handlePublicSite(req, env, path);
  if (path === '/api/public/store' || path.startsWith('/api/public/store/')) return handlePublicStore(req, env, path);
  if (path.startsWith('/api/c/')) return handleCustomer(req, env, path);
  if (path.startsWith('/api/public/push/')) return handlePublicPush(req, env, path);
  if (path.startsWith('/api/u/push/')) return handleUserPush(req, env, path);
  if (path === '/api/verify' && m === 'POST') return verify(req, env);
  if (path === '/api/loyalty/claim' && m === 'POST') return loyaltyClaim(req, env);
  if (path === '/api/loyalty/wallet' && m === 'POST') return loyaltyWallet(req, env);
  if (path === '/api/loyalty/redeem' && m === 'POST') return loyaltyRedeem(req, env);
  if (path === '/api/rate' && m === 'POST') return rate(req, env);
  if (path === '/api/public/brands' && m === 'GET') return brands(env);
  if (path === '/api/public/stats' && m === 'GET') return stats(env);
  if (path === '/api/public/human' && m === 'GET') return humanConfig(env);
  if (path === '/api/public/join' && m === 'POST') return joinRequest(req, env);
  if (path === '/api/public/shop-ai' && (m === 'GET' || m === 'POST')) return shopAiRoute(req, env);
  if (path === '/api/public/assistant' && m === 'GET') return guideInfo(env);
  if (path === '/api/public/assistant' && m === 'POST') return guideChat(req, env);
  const bm = path.match(/^\/api\/public\/brands\/([a-z0-9-]{2,40})$/);
  if (bm && m === 'GET') return brandPage(env, bm[1]);
  if (path === '/api/enter' && m === 'POST') return enter(req, env);
  if (path === '/api/report' && m === 'POST') return report(req, env);
  if (path === '/api/guarantee' && m === 'POST') return guarantee(req, env);
  if (path === '/api/public/fakes-map' || path === '/api/public/seller') return handlePublicTrust(req, env, path);
  if (path === '/api/public/merchants-page') return handlePublicGrowth(req, env, path);
  if (path === '/api/auth/login' && m === 'POST') return login(req, env);
  if (path === '/api/auth/login/2fa' && m === 'POST') return login2fa(req, env);
  if (path === '/api/auth/security' && m === 'GET') return security(req, env);
  if (path === '/api/auth/2fa/setup' && m === 'POST') return totpSetup(req, env);
  if (path === '/api/auth/2fa/enable' && m === 'POST') return totpEnable(req, env);
  if (path === '/api/auth/2fa/disable' && m === 'POST') return totpDisable(req, env);
  if (path === '/api/auth/sessions/end' && m === 'POST') return endSessions(req, env);
  if (path === '/api/auth/logout' && m === 'POST') return logout(req, env);
  if (path === '/api/auth/me' && m === 'GET') return me(req, env);
  if (path === '/api/auth/password' && m === 'POST') return changePassword(req, env);
  if (path === '/api/setup' && m === 'POST') return setup(req, env);
  if (path === '/api/auth/forgot' && m === 'POST') return forgotPassword(req, env);
  if (path === '/api/auth/reset' && m === 'POST') return resetPassword(req, env);
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
    // المتجر الخاص يقدر يظهر داخل لوحة التاجر للمعاينة (نفس الموقع بس)
    if (new URL(req.url).pathname.startsWith('/s/')) {
      out.headers.set('X-Frame-Options', 'SAMEORIGIN');
      out.headers.set('Content-Security-Policy', SITE_CSP);
    }
    return out;
  },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(
      prepare(env).then(async (e) => {
        await runAlerts(e);
        await notifyMerchants(e).catch((err) => console.error('ASALAH_NOTIFY', err?.stack || err));
        await runStoreSync(e).catch((err) => console.error('ASALAH_SYNC', err?.stack || err));
        await runCampaigns(e.DB).catch((err) => console.error('ASALAH_PUSH', err?.stack || err));
        await runWeekly(e).catch((err) => console.error('ASALAH_WEEKLY', err?.stack || err));
        await runMonthly(e).catch((err) => console.error('ASALAH_MONTHLY', err?.stack || err));
        await runBackup(e).catch((err) => console.error('ASALAH_BACKUP', err?.stack || err));
      })
    );
  },
};
