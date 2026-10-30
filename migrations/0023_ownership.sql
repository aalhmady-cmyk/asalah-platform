-- الملكية: المسح قبل الشراء فحص بس، والعلامة تنربط بالجوال لما العميل يضغط «اشتريت المنتج»
ALTER TABLE tags ADD COLUMN owner_at INTEGER;
ALTER TABLE tags ADD COLUMN owner_city TEXT;
ALTER TABLE tags ADD COLUMN owner_phone TEXT;
-- إعادة التفعيل تبدأ عدّ الجوالات من جديد: نحسب المسحات اللي رقمها أكبر من هذا
ALTER TABLE tags ADD COLUMN count_from INTEGER NOT NULL DEFAULT 0;
-- العلامات المربوطة بالنظام القديم (أول جهاز مسح) نعتبرها مملوكة من أول فحص
UPDATE tags SET owner_at=first_checked_at WHERE first_device IS NOT NULL AND owner_at IS NULL;
