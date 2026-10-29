-- مزايا الثقة: بلاغ بصورة، ضمان أصالة، رسالة صوتية، بائع معتمد، مستويات العميل، الملخص الأسبوعي
ALTER TABLE reports ADD COLUMN photo_key TEXT;
ALTER TABLE reports ADD COLUMN ai_verdict TEXT;
ALTER TABLE reports ADD COLUMN ai_score INTEGER;
ALTER TABLE merchants ADD COLUMN guarantee_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE merchants ADD COLUMN guarantee_terms TEXT;
ALTER TABLE merchants ADD COLUMN voice_key TEXT;
ALTER TABLE merchants ADD COLUMN voice_type TEXT;
ALTER TABLE merchants ADD COLUMN weekly_summary INTEGER NOT NULL DEFAULT 1;
CREATE TABLE guarantee_claims (
  id INTEGER PRIMARY KEY,
  merchant_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  city TEXT NOT NULL,
  point_of_sale TEXT NOT NULL,
  note TEXT,
  photo_key TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','approved','rejected')),
  decision_note TEXT,
  decided_by INTEGER,
  created_at INTEGER NOT NULL,
  decided_at INTEGER
);
CREATE INDEX guarantee_merchant ON guarantee_claims(merchant_id, created_at);
-- مستوى العميل: كم منتج أصلي تحقق منه نفس الجهاز
CREATE INDEX tags_first_device ON tags(first_device);
CREATE INDEX tags_second_device ON tags(second_device);
