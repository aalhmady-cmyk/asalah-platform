-- أصالة المنتجات الأصلية: الهيكل الأول
-- كل الأوقات بثواني Unix (UTC). اليوم يُحسب بتوقيت الرياض (+3) في الاستعلامات.

CREATE TABLE merchants (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  logo_url TEXT,
  brand_color TEXT NOT NULL DEFAULT '#0E6B4E',
  store_url TEXT,
  whatsapp TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  low_stock_threshold INTEGER NOT NULL DEFAULT 5000,
  max_checks INTEGER NOT NULL DEFAULT 5,
  contest_enabled INTEGER NOT NULL DEFAULT 0,
  contest_title TEXT,
  contest_ends_at INTEGER,
  contest_terms_url TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','merchant')),
  merchant_id INTEGER REFERENCES merchants(id),
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at INTEGER NOT NULL,
  last_login_at INTEGER,
  CHECK ((role = 'admin' AND merchant_id IS NULL) OR (role = 'merchant' AND merchant_id IS NOT NULL))
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);

-- دفعة = مجموعة علامات متسلسلة لتاجر واحد. العلامات نفسها ما تُخزَّن مسبقاً:
-- رابط كل علامة موقّع من (رقم الدفعة + الرقم التسلسلي)، وسجلها ينشأ أول ما تنمسح أو تتوقف.
CREATE TABLE batches (
  id INTEGER PRIMARY KEY,
  merchant_id INTEGER NOT NULL REFERENCES merchants(id),
  code TEXT NOT NULL UNIQUE,
  size INTEGER NOT NULL CHECK (size BETWEEN 1 AND 1000000),
  salt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','blocked')),
  is_test INTEGER NOT NULL DEFAULT 0,
  product_name TEXT,
  produced_on TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at INTEGER NOT NULL,
  activated_at INTEGER
);
CREATE INDEX batches_merchant ON batches(merchant_id, status);

CREATE TABLE tags (
  id INTEGER PRIMARY KEY,
  batch_id INTEGER NOT NULL REFERENCES batches(id),
  merchant_id INTEGER NOT NULL REFERENCES merchants(id),
  serial INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','blocked_merchant','blocked_admin','auto_locked')),
  check_count INTEGER NOT NULL DEFAULT 0,
  first_device TEXT,
  second_device TEXT,
  first_checked_at INTEGER,
  last_checked_at INTEGER,
  entry_done INTEGER NOT NULL DEFAULT 0,
  UNIQUE (batch_id, serial)
);
CREATE INDEX tags_merchant_first ON tags(merchant_id, first_checked_at);
CREATE INDEX tags_merchant_status ON tags(merchant_id, status);

CREATE TABLE scans (
  id INTEGER PRIMARY KEY,
  tag_id INTEGER,
  merchant_id INTEGER,
  result TEXT NOT NULL,
  check_no INTEGER,
  country TEXT,
  city TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX scans_merchant_time ON scans(merchant_id, created_at);
CREATE INDEX scans_time ON scans(created_at);
CREATE INDEX scans_tag ON scans(tag_id, id);

-- أكواد ما لها أصل عندنا (مقلّدة أو مخمَّنة). نحفظ الـ hash وأول 8 أحرف فقط.
CREATE TABLE unknown_codes (
  code_hash TEXT PRIMARY KEY,
  preview TEXT NOT NULL,
  merchant_id INTEGER,
  count INTEGER NOT NULL,
  country TEXT,
  city TEXT,
  first_at INTEGER NOT NULL,
  last_at INTEGER NOT NULL
);
CREATE INDEX unknown_merchant ON unknown_codes(merchant_id, last_at);

CREATE TABLE entries (
  id INTEGER PRIMARY KEY,
  tag_id INTEGER NOT NULL UNIQUE REFERENCES tags(id),
  merchant_id INTEGER NOT NULL REFERENCES merchants(id),
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  city TEXT NOT NULL,
  point_of_sale TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX entries_merchant ON entries(merchant_id, created_at);

CREATE TABLE reports (
  id INTEGER PRIMARY KEY,
  merchant_id INTEGER,
  tag_id INTEGER,
  reason TEXT NOT NULL,
  city TEXT NOT NULL,
  point_of_sale TEXT NOT NULL,
  phone TEXT,
  note TEXT,
  ip_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX reports_merchant ON reports(merchant_id, created_at);

CREATE TABLE alerts (
  id INTEGER PRIMARY KEY,
  merchant_id INTEGER,
  kind TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  read_at INTEGER
);
CREATE INDEX alerts_merchant ON alerts(merchant_id, kind, created_at);

CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  merchant_id INTEGER,
  action TEXT NOT NULL,
  detail TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX audit_merchant ON audit_log(merchant_id, id);

CREATE TABLE rate_limits (
  key TEXT NOT NULL,
  win INTEGER NOT NULL,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (key, win)
);
