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
