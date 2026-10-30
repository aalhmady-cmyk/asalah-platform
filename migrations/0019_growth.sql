-- طلبات التجار الجدد (من المساعد أو يدوي) ومراحلها في اللوحة الأم
CREATE TABLE leads (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT NOT NULL,
  phone TEXT,
  product TEXT,
  qty TEXT,
  source TEXT NOT NULL DEFAULT 'guide',
  status TEXT NOT NULL DEFAULT 'new',
  note TEXT,
  merchant_id INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX leads_status ON leads(status, id);
