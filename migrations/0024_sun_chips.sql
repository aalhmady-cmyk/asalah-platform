-- شرائح NTAG 424 DNA: نربط رقم الشريحة (UID) بالعلامة أول مرة، ونحفظ آخر عدّاد عشان الرابط المنسوخ ما ينفع مرتين
ALTER TABLE tags ADD COLUMN chip_uid TEXT;
ALTER TABLE tags ADD COLUMN sun_ctr INTEGER;
ALTER TABLE tags ADD COLUMN sun_device TEXT;
CREATE UNIQUE INDEX tags_chip_uid ON tags(chip_uid) WHERE chip_uid IS NOT NULL;
