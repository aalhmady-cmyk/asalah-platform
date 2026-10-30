// النظام يجهّز قاعدته بنفسه: أول طلب بعد النشر ينفّذ ملفات migrations اللي ما انطبقت.
// يستخدم نفس جدول d1_migrations حق wrangler، فأمر `wrangler d1 migrations apply` يبقى يشتغل معه.
import m0001 from '../../migrations/0001_init.sql';
import m0002 from '../../migrations/0002_images.sql';
import m0003 from '../../migrations/0003_settings.sql';
import m0004 from '../../migrations/0004_image_store.sql';
import m0005 from '../../migrations/0005_draws_sellers.sql';
import m0006 from '../../migrations/0006_loyalty.sql';
import m0007 from '../../migrations/0007_store.sql';
import m0008 from '../../migrations/0008_store_plus.sql';
import m0009 from '../../migrations/0009_reel_clip_family.sql';
import m0010 from '../../migrations/0010_reel_comments.sql';
import m0011 from '../../migrations/0011_customers_reviews.sql';
import m0012 from '../../migrations/0012_admin_staff_stats.sql';
import m0013 from '../../migrations/0013_push.sql';
import m0014 from '../../migrations/0014_qr_batches.sql';
import m0015 from '../../migrations/0015_push_hide.sql';
import m0016 from '../../migrations/0016_user_push.sql';
import m0017 from '../../migrations/0017_trust_features.sql';
import m0018 from '../../migrations/0018_verify_sound.sql';
import m0019 from '../../migrations/0019_growth.sql';
import m0020 from '../../migrations/0020_own_store.sql';
import m0021 from '../../migrations/0021_scan_history.sql';
import m0022 from '../../migrations/0022_security.sql';
import m0023 from '../../migrations/0023_ownership.sql';
import m0024 from '../../migrations/0024_sun_chips.sql';
import m0025 from '../../migrations/0025_privacy.sql';
import { randomHex } from './util.js';

const MIGRATIONS = [
  ['0001_init.sql', m0001],
  ['0002_images.sql', m0002],
  ['0003_settings.sql', m0003],
  ['0004_image_store.sql', m0004],
  ['0005_draws_sellers.sql', m0005],
  ['0006_loyalty.sql', m0006],
  ['0007_store.sql', m0007],
  ['0008_store_plus.sql', m0008],
  ['0009_reel_clip_family.sql', m0009],
  ['0010_reel_comments.sql', m0010],
  ['0011_customers_reviews.sql', m0011],
  ['0012_admin_staff_stats.sql', m0012],
  ['0013_push.sql', m0013],
  ['0014_qr_batches.sql', m0014],
  ['0015_push_hide.sql', m0015],
  ['0016_user_push.sql', m0016],
  ['0017_trust_features.sql', m0017],
  ['0018_verify_sound.sql', m0018],
  ['0019_growth.sql', m0019],
  ['0020_own_store.sql', m0020],
  ['0021_scan_history.sql', m0021],
  ['0022_security.sql', m0022],
  ['0023_ownership.sql', m0023],
  ['0024_sun_chips.sql', m0024],
  ['0025_privacy.sql', m0025],
];

// يقسم الملف لجمل: نشيل التعليقات ونقسم على ; في آخر السطر
const statements = (sql) =>
  sql
    .replace(/--[^\n]*/g, '')
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean);

let ready = null;

async function migrate(db) {
  await db.prepare('CREATE TABLE IF NOT EXISTS d1_migrations(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL)').run();
  const done = new Set((await db.prepare('SELECT name FROM d1_migrations').all()).results.map((r) => r.name));
  for (const [name, sql] of MIGRATIONS) {
    if (done.has(name)) continue;
    // الملف والتسجيل في دفعة وحدة (معاملة وحدة)، فلو طلبين جو مع بعض واحد بس ينجح
    try {
      await db.batch([...statements(sql).map((s) => db.prepare(s)), db.prepare('INSERT INTO d1_migrations(name) VALUES(?)').bind(name)]);
    } catch (e) {
      const again = await db.prepare('SELECT 1 FROM d1_migrations WHERE name=?').bind(name).first();
      if (!again) throw e;
    }
  }
}

// سر توقيع العلامات: من أسرار Cloudflare لو انضاف، وإلا يتولّد مرة وحدة ويُحفظ في القاعدة
async function tagSecret(db) {
  await db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES('tag_secret',?)").bind(randomHex(32)).run();
  return (await db.prepare("SELECT value FROM settings WHERE key='tag_secret'").first()).value;
}

export async function prepare(env) {
  if (!ready) {
    ready = (async () => {
      await migrate(env.DB);
      return env.TAG_SECRET || (await tagSecret(env.DB));
    })().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return { ...env, TAG_SECRET: await ready };
}
