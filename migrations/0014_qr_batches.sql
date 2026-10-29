-- دفعات QR: نفس العلامة بس مطبوعة كملصق بدل شريحة NFC
ALTER TABLE batches ADD COLUMN kind TEXT NOT NULL DEFAULT 'nfc';
