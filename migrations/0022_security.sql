-- التحقق بخطوتين (تطبيق المصادقة) ورموز احتياطية
ALTER TABLE users ADD COLUMN totp_secret TEXT;
ALTER TABLE users ADD COLUMN totp_on INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN totp_last INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN backup_codes TEXT;
-- الجلسات: من أي جهاز ومدينة، عشان صاحب الحساب يشوفها ويطلّعها
ALTER TABLE sessions ADD COLUMN device_kind TEXT;
ALTER TABLE sessions ADD COLUMN city TEXT;
-- خطوة الرمز بعد كلمة المرور
CREATE TABLE IF NOT EXISTS login_tickets (
  ticket_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  tries INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL
);
-- الأجهزة اللي دخل منها الحساب قبل، والجديد منها يطلع له تنبيه
CREATE TABLE IF NOT EXISTS known_devices (
  user_id INTEGER NOT NULL,
  dev_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, dev_hash)
);
