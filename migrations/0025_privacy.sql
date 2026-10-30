-- طلبات حذف البيانات (نظام حماية البيانات الشخصية): العميل يطلب برقم جواله، والإدارة تنفّذ
CREATE TABLE privacy_requests (
  id INTEGER PRIMARY KEY,
  phone TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','done','rejected')),
  erased INTEGER,
  created_at INTEGER NOT NULL,
  done_at INTEGER,
  done_by INTEGER
);
CREATE INDEX privacy_requests_status ON privacy_requests(status, id);
