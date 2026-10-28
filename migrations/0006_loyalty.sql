-- برنامج الولاء (نقاط أو كاش باك)، تقييم المنتج، وتاريخ الانتهاء وتفاصيل المنتج لكل دفعة.
-- الكاش باك يُخزَّن بالهللة (1 ريال = 100).
ALTER TABLE merchants ADD COLUMN loyalty_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE merchants ADD COLUMN loyalty_mode TEXT NOT NULL DEFAULT 'points';
ALTER TABLE merchants ADD COLUMN loyalty_per_tag INTEGER NOT NULL DEFAULT 10;
ALTER TABLE merchants ADD COLUMN loyalty_min_redeem INTEGER NOT NULL DEFAULT 100;
ALTER TABLE merchants ADD COLUMN loyalty_reward TEXT;
ALTER TABLE merchants ADD COLUMN ratings_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE tags ADD COLUMN loyalty_claimed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE batches ADD COLUMN expires_on TEXT;
ALTER TABLE batches ADD COLUMN details TEXT;

CREATE TABLE loyalty_members (
  id INTEGER PRIMARY KEY,
  merchant_id INTEGER NOT NULL REFERENCES merchants(id),
  phone TEXT NOT NULL,
  name TEXT,
  balance INTEGER NOT NULL DEFAULT 0,
  earned_total INTEGER NOT NULL DEFAULT 0,
  tags_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  last_at INTEGER NOT NULL,
  UNIQUE (merchant_id, phone)
);
CREATE INDEX loyalty_members_top ON loyalty_members(merchant_id, earned_total);

-- الأجهزة اللي جمعت نقاط لرقم معيّن. الاستبدال مسموح بس من جهاز منها.
CREATE TABLE loyalty_devices (
  member_id INTEGER NOT NULL REFERENCES loyalty_members(id),
  device TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (member_id, device)
);

CREATE TABLE loyalty_events (
  id INTEGER PRIMARY KEY,
  merchant_id INTEGER NOT NULL,
  member_id INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('earn','redeem','refund')),
  amount INTEGER NOT NULL,
  tag_id INTEGER,
  redemption_id INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX loyalty_events_member ON loyalty_events(member_id, id);
CREATE INDEX loyalty_events_merchant ON loyalty_events(merchant_id, created_at);

CREATE TABLE redemptions (
  id INTEGER PRIMARY KEY,
  merchant_id INTEGER NOT NULL REFERENCES merchants(id),
  member_id INTEGER NOT NULL REFERENCES loyalty_members(id),
  code TEXT NOT NULL,
  amount INTEGER NOT NULL,
  reward TEXT,
  status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','used','cancelled')),
  created_at INTEGER NOT NULL,
  used_at INTEGER,
  used_by INTEGER,
  UNIQUE (merchant_id, code)
);
CREATE INDEX redemptions_merchant ON redemptions(merchant_id, status, id);

CREATE TABLE ratings (
  tag_id INTEGER PRIMARY KEY REFERENCES tags(id),
  merchant_id INTEGER NOT NULL,
  batch_id INTEGER NOT NULL,
  stars INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX ratings_merchant ON ratings(merchant_id, created_at);
