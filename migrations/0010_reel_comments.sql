-- تعليقات وتقييم الريلز (بالنجوم من 1 إلى 5)، والعدادات محفوظة في الريل عشان العرض يكون سريع
ALTER TABLE reels ADD COLUMN comments INTEGER NOT NULL DEFAULT 0;
ALTER TABLE reels ADD COLUMN rating_sum INTEGER NOT NULL DEFAULT 0;
ALTER TABLE reels ADD COLUMN rating_n INTEGER NOT NULL DEFAULT 0;
CREATE TABLE reel_comments (
  id INTEGER PRIMARY KEY,
  reel_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  body TEXT,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  ip_hash TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX reel_comments_reel ON reel_comments(reel_id, id);
