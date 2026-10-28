-- إعدادات داخلية يولّدها النظام بنفسه (مثل سر توقيع العلامات لو ما انضاف كسر في Cloudflare)
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
