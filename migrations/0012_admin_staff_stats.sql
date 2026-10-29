-- إيقاف الإدارة لمنتج أو ريل (التاجر ما يقدر يرجعه)، وجدولة الريلز
ALTER TABLE store_products ADD COLUMN admin_blocked INTEGER NOT NULL DEFAULT 0;
ALTER TABLE reels ADD COLUMN admin_blocked INTEGER NOT NULL DEFAULT 0;
ALTER TABLE reels ADD COLUMN publish_at INTEGER;
-- رد التاجر تحت تعليق الزبون
ALTER TABLE reel_comments ADD COLUMN reply TEXT;
ALTER TABLE reel_comments ADD COLUMN reply_at INTEGER;
ALTER TABLE product_comments ADD COLUMN reply TEXT;
ALTER TABLE product_comments ADD COLUMN reply_at INTEGER;
-- حساب التاجر: owner صاحب الحساب، staff موظف بصلاحيات محدودة
ALTER TABLE users ADD COLUMN merchant_role TEXT NOT NULL DEFAULT 'owner';
-- روابط إعادة كلمة المرور (نحفظ الـ hash فقط)
CREATE TABLE password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_by INTEGER,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);
-- مشاهدات وضغطات كل يوم لكل منتج (p) وريل (r)
CREATE TABLE store_daily (
  day TEXT NOT NULL,
  kind TEXT NOT NULL,
  item_id INTEGER NOT NULL,
  merchant_id INTEGER NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, kind, item_id)
);
CREATE INDEX store_daily_m ON store_daily(merchant_id, day);
-- الزبون يتابع سعر منتج، وتنبيهاته داخل حسابه
CREATE TABLE price_watch (
  customer_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  price_at INTEGER,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (customer_id, product_id)
);
CREATE INDEX price_watch_p ON price_watch(product_id);
CREATE TABLE customer_notes (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL,
  product_id INTEGER,
  link TEXT,
  message TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  read_at INTEGER
);
CREATE INDEX customer_notes_c ON customer_notes(customer_id, id);
