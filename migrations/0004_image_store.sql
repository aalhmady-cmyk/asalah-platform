-- الصور (صور المنتجات والشعارات) تنحفظ في القاعدة نفسها، فما نحتاج تفعيل R2 في الحساب.
-- الصورة تتصغّر في المتصفح قبل الرفع، وحدّها 1 ميجا.
CREATE TABLE IF NOT EXISTS images (
  key TEXT PRIMARY KEY,
  content_type TEXT NOT NULL,
  data BLOB NOT NULL,
  created_at INTEGER NOT NULL
);
