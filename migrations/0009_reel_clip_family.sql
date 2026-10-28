-- الريل ممكن يكون الفيديو الأصلي نفسه، ونحفظ معه وين يبدأ وكيف ينقص، والعرض يطبّق القص.
-- (الآيفون ما يقدر يعيد تسجيل الفيديو في المتصفح بشكل موثوق)
ALTER TABLE reels ADD COLUMN clip_mode INTEGER NOT NULL DEFAULT 0;
ALTER TABLE reels ADD COLUMN clip_start REAL NOT NULL DEFAULT 0;
ALTER TABLE reels ADD COLUMN clip_zoom REAL NOT NULL DEFAULT 1;
ALTER TABLE reels ADD COLUMN clip_x REAL NOT NULL DEFAULT 0.5;
ALTER TABLE reels ADD COLUMN clip_y REAL NOT NULL DEFAULT 0.5;

-- سلة العائلة: قائمة مشتركة برابط، كل واحد يضيف أغراضه باسمه، والشراء من متجر التاجر
CREATE TABLE family_lists (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE family_items (
  id INTEGER PRIMARY KEY,
  list_id INTEGER NOT NULL REFERENCES family_lists(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL,
  who TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1,
  bought INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX family_items_list ON family_items(list_id, id);
