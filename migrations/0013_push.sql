-- إشعارات الجوال: اشتراكات الأجهزة وحملات اللوحة الأم
CREATE TABLE push_subs (
  id INTEGER PRIMARY KEY,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  customer_id INTEGER,
  lang TEXT NOT NULL DEFAULT 'ar',
  created_at INTEGER NOT NULL,
  last_at INTEGER NOT NULL
);
CREATE INDEX push_subs_c ON push_subs(customer_id);
CREATE TABLE push_campaigns (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  url TEXT,
  image TEXT,
  audience TEXT NOT NULL DEFAULT 'all',
  status TEXT NOT NULL DEFAULT 'sending',
  cursor INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  sent INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER,
  created_at INTEGER NOT NULL,
  done_at INTEGER
);
