-- صورة المنتج لكل دفعة، وشعار التاجر المرفوع (بدل رابط خارجي)
ALTER TABLE batches ADD COLUMN image_key TEXT;
ALTER TABLE merchants ADD COLUMN logo_key TEXT;
