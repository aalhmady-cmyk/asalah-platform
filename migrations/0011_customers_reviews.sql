-- حسابات العملاء (دخول بحساب Google) عشان التعليقات تكون من ناس حقيقيين
CREATE TABLE customers (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  picture TEXT,
  created_at INTEGER NOT NULL,
  last_at INTEGER NOT NULL
);
CREATE TABLE customer_sessions (
  token_hash TEXT PRIMARY KEY,
  customer_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
-- تقييم وتعليقات المنتجات في المتاجر
ALTER TABLE store_products ADD COLUMN comments INTEGER NOT NULL DEFAULT 0;
ALTER TABLE store_products ADD COLUMN rating_sum INTEGER NOT NULL DEFAULT 0;
ALTER TABLE store_products ADD COLUMN rating_n INTEGER NOT NULL DEFAULT 0;
CREATE TABLE product_comments (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL,
  customer_id INTEGER,
  name TEXT NOT NULL,
  body TEXT,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  voter TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX product_comments_p ON product_comments(product_id, id);
ALTER TABLE reel_comments ADD COLUMN customer_id INTEGER;
