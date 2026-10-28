-- متاجر أصالة: اشتراك التاجر بالمتجر، منتجاته، والريلز.
-- الأسعار بالهللة. الشراء يتم في متجر التاجر (سلة) عبر buy_url.
ALTER TABLE merchants ADD COLUMN store_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE merchants ADD COLUMN store_since INTEGER;

CREATE TABLE store_products (
  id INTEGER PRIMARY KEY,
  merchant_id INTEGER NOT NULL REFERENCES merchants(id),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'other',
  price INTEGER NOT NULL,
  old_price INTEGER,
  buy_url TEXT NOT NULL,
  image_key TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','hidden')),
  views INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX store_products_merchant ON store_products(merchant_id, id);
CREATE INDEX store_products_public ON store_products(status, category, id);

-- الفيديو نفسه في R2 (المفتاح video_key)، والغلاف صورة في جدول images.
CREATE TABLE reels (
  id INTEGER PRIMARY KEY,
  merchant_id INTEGER NOT NULL REFERENCES merchants(id),
  product_id INTEGER REFERENCES store_products(id),
  title TEXT NOT NULL,
  video_key TEXT,
  video_type TEXT,
  video_bytes INTEGER,
  poster_key TEXT,
  duration INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading','active','hidden')),
  views INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX reels_merchant ON reels(merchant_id, id);
CREATE INDEX reels_public ON reels(status, id);
