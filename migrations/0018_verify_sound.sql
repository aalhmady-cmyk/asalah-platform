-- صوت نتيجة التحقق (جرس وصوت للأصلي، طوط وتحذير للمقلّد). التاجر يوقفه لمنتجاته، والمدير يوقفه للكل من settings.verify_sound
ALTER TABLE merchants ADD COLUMN verify_sound INTEGER NOT NULL DEFAULT 1;
