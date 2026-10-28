-- السحب على الفائزين، استبعاد الأرقام، نقاط البيع المعتمدة، وظهور التاجر في الموقع العام.
CREATE TABLE draws (
  id INTEGER PRIMARY KEY,
  merchant_id INTEGER NOT NULL REFERENCES merchants(id),
  title TEXT NOT NULL,
  winners_count INTEGER NOT NULL,
  pool_size INTEGER NOT NULL,
  from_at INTEGER,
  to_at INTEGER,
  created_by INTEGER REFERENCES users(id),
  created_at INTEGER NOT NULL
);
CREATE INDEX draws_merchant ON draws(merchant_id, id);

CREATE TABLE draw_winners (
  draw_id INTEGER NOT NULL REFERENCES draws(id),
  rank INTEGER NOT NULL,
  entry_id INTEGER NOT NULL REFERENCES entries(id),
  phone TEXT NOT NULL,
  PRIMARY KEY (draw_id, rank)
);
CREATE INDEX draw_winners_phone ON draw_winners(phone);

CREATE TABLE excluded_phones (
  merchant_id INTEGER NOT NULL REFERENCES merchants(id),
  phone TEXT NOT NULL,
  reason TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (merchant_id, phone)
);

-- نقاط البيع المعتمدة: تظهر في صفحة التاجر العامة "وين ألقى الأصلي؟"
CREATE TABLE sellers (
  id INTEGER PRIMARY KEY,
  merchant_id INTEGER NOT NULL REFERENCES merchants(id),
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  address TEXT,
  map_url TEXT,
  phone TEXT,
  online INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX sellers_merchant ON sellers(merchant_id, city);

ALTER TABLE merchants ADD COLUMN public_listed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE merchants ADD COLUMN about TEXT;
