-- متجر التاجر الخاص (برابط /s/slug) ومساعد البناء بالنقاط، وطلبات العملاء والسلات المتروكة.
-- config: المنشور، draft: المسودة اللي يشتغل عليها التاجر والمساعد، undo: آخر نسخ المسودة للتراجع.
CREATE TABLE merchant_sites (
  merchant_id INTEGER PRIMARY KEY REFERENCES merchants(id),
  config TEXT,
  draft TEXT,
  undo TEXT,
  published_at INTEGER,
  views INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- صفحة هبوط لكل منتج (عنوان ومزايا وأسئلة) يكتبها المساعد أو التاجر
ALTER TABLE store_products ADD COLUMN landing TEXT;

-- نقاط المساعد: الرصيد، والمصروف، وهل استلم النقاط المجانية
ALTER TABLE merchants ADD COLUMN ai_credits INTEGER NOT NULL DEFAULT 0;
ALTER TABLE merchants ADD COLUMN ai_used INTEGER NOT NULL DEFAULT 0;
ALTER TABLE merchants ADD COLUMN ai_free_given INTEGER NOT NULL DEFAULT 0;
CREATE TABLE ai_credit_log (
  id INTEGER PRIMARY KEY,
  merchant_id INTEGER NOT NULL,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX ai_credit_log_merchant ON ai_credit_log(merchant_id, id);

-- الطلب يبدأ "سلة" (cart) وتتحدث مع العميل، ولما يضغط شراء يصير new برقم طلب.
-- السلة المتروكة = cart ما تحدثت من 30 دقيقة.
CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  merchant_id INTEGER NOT NULL REFERENCES merchants(id),
  token TEXT NOT NULL,
  number TEXT,
  status TEXT NOT NULL DEFAULT 'cart' CHECK (status IN ('cart','new','confirmed','shipped','cancelled')),
  items TEXT NOT NULL,
  total INTEGER NOT NULL DEFAULT 0,
  name TEXT,
  phone TEXT,
  city TEXT,
  note TEXT,
  consent INTEGER NOT NULL DEFAULT 0,
  channel TEXT,
  coupon TEXT,
  merchant_note TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  ordered_at INTEGER
);
CREATE UNIQUE INDEX orders_cart ON orders(merchant_id, token) WHERE status='cart';
CREATE UNIQUE INDEX orders_number ON orders(number);
CREATE INDEX orders_merchant ON orders(merchant_id, status, updated_at);
