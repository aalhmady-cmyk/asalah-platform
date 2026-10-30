-- سجل المسحات لكل علامة: أي جهاز ونوعه، عشان العميل يشوف وين ومتى انمسحت قبله
ALTER TABLE scans ADD COLUMN device TEXT;
ALTER TABLE scans ADD COLUMN device_kind TEXT;
CREATE INDEX IF NOT EXISTS scans_tag ON scans(tag_id, created_at);
-- علامة انمسحت في مدينتين بعيدتين خلال وقت قصير
ALTER TABLE tags ADD COLUMN flagged_at INTEGER;
