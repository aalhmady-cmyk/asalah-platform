-- تطويرات المتاجر: ربط الدفعة بمنتج في المتجر، كوبون أصالة، لايكات الريلز، مزامنة سلة، وسجل إشعارات واتساب.
ALTER TABLE batches ADD COLUMN store_product_id INTEGER;
ALTER TABLE merchants ADD COLUMN store_coupon TEXT;
ALTER TABLE merchants ADD COLUMN store_coupon_note TEXT;
ALTER TABLE merchants ADD COLUMN coupon_copies INTEGER NOT NULL DEFAULT 0;
ALTER TABLE merchants ADD COLUMN store_auto_sync INTEGER NOT NULL DEFAULT 0;
ALTER TABLE merchants ADD COLUMN notify_whatsapp INTEGER NOT NULL DEFAULT 1;
-- رقم صاحب المتجر للتنبيهات (غير رقم واتساب خدمة العملاء اللي يظهر للعميل)
ALTER TABLE merchants ADD COLUMN alert_phone TEXT;
ALTER TABLE reels ADD COLUMN likes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE store_products ADD COLUMN synced_at INTEGER;
ALTER TABLE store_products ADD COLUMN sync_error TEXT;
CREATE INDEX store_products_sync ON store_products(merchant_id, synced_at);
CREATE INDEX reels_popular ON reels(status, views);

CREATE TABLE notifications (
  id INTEGER PRIMARY KEY,
  merchant_id INTEGER,
  channel TEXT NOT NULL,
  to_addr TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','skipped')),
  error TEXT,
  created_at INTEGER NOT NULL,
  sent_at INTEGER
);
CREATE INDEX notifications_merchant ON notifications(merchant_id, id);
