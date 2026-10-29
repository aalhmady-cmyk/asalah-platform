-- إشعارات الجوال لحسابات اللوحات (التاجر والموظف والمدير)، منفصلة عن اشتراكات العملاء
CREATE TABLE user_push (
  id INTEGER PRIMARY KEY,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  last_at INTEGER NOT NULL
);
CREATE INDEX user_push_u ON user_push(user_id);
