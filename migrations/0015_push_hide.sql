-- حذف الإشعارات من صندوق التطبيق عند كل العملاء (نخلي السجل للإحصائيات)
ALTER TABLE push_campaigns ADD COLUMN hidden_at INTEGER;
