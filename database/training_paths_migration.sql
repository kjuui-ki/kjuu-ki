-- ═══════════════════════════════════════════════════════════════════════════
-- ترميز النصوص: Supabase يستخدم PostgreSQL مع ترميز UTF-8 للاتصال والتخزين.
-- تأكد من أن بياناتك (INSERT/CSV) محفوظة كملفات UTF-8 حتى تظهر العربية بشكل صحيح.
-- ═══════════════════════════════════════════════════════════════════════════
-- ماهر — المسارات التدريبية، التسعير، إشعارات لوحة التحكم
-- نفّذ في Supabase → SQL Editor بالترتيب:
--   1) هذا الملف (training_paths_migration.sql)
--   2) seed_training_catalog.sql (بعد توليده عبر: node database/generate_training_seed.mjs)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1) جدول المسارات ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.training_paths (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug        TEXT NOT NULL UNIQUE,
    name_ar     TEXT NOT NULL,
    name_en     TEXT,
    icon        TEXT NOT NULL DEFAULT '📘',
    sort_order  INTEGER NOT NULL DEFAULT 0,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.training_paths DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_training_paths_active ON public.training_paths (is_active, sort_order);

-- ── 2) توسيع جدول الدورات ─────────────────────────────────────────────────
ALTER TABLE public.courses
    ADD COLUMN IF NOT EXISTS training_path_id UUID REFERENCES public.training_paths(id) ON DELETE SET NULL;

ALTER TABLE public.courses
    ADD COLUMN IF NOT EXISTS content_type TEXT NOT NULL DEFAULT 'course';

ALTER TABLE public.courses DROP CONSTRAINT IF EXISTS courses_content_type_chk;
ALTER TABLE public.courses ADD CONSTRAINT courses_content_type_chk
    CHECK (content_type IN ('course', 'diploma'));

ALTER TABLE public.courses
    ADD COLUMN IF NOT EXISTS price_type TEXT NOT NULL DEFAULT 'free';

ALTER TABLE public.courses DROP CONSTRAINT IF EXISTS courses_price_type_chk;
ALTER TABLE public.courses ADD CONSTRAINT courses_price_type_chk
    CHECK (price_type IN ('free', 'paid'));

ALTER TABLE public.courses
    ADD COLUMN IF NOT EXISTS price_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_courses_training_path ON public.courses (training_path_id);

-- ── 3) إشعارات المشرفين ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type        TEXT NOT NULL DEFAULT 'enrollment',
    title       TEXT NOT NULL,
    body        TEXT,
    meta        JSONB DEFAULT '{}'::JSONB,
    read_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admin_notifications DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_admin_notifications_unread ON public.admin_notifications (created_at DESC) WHERE read_at IS NULL;

-- ── 4) توليد إشعار عند كل تسجيل جديد في دورة ─────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_admin_new_enrollment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    ctitle TEXT;
    pname  TEXT;
BEGIN
    SELECT c.title, COALESCE(tp.name_ar, '')
    INTO ctitle, pname
    FROM public.courses c
    LEFT JOIN public.training_paths tp ON tp.id = c.training_path_id
    WHERE c.id = NEW.course_id;

    INSERT INTO public.admin_notifications (type, title, body, meta)
    VALUES (
        'enrollment',
        'تسجيل جديد في دورة',
        COALESCE(ctitle, 'دورة')
            || CASE WHEN pname <> '' THEN ' — المسار: ' || pname ELSE '' END,
        jsonb_build_object(
            'enrollment_id', NEW.id,
            'course_id', NEW.course_id,
            'user_id', NEW.user_id,
            'created_at', NEW.created_at,
            'training_path_name', NULLIF(pname, '')
        )
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_course_enrollment_notify ON public.course_enrollments;

CREATE TRIGGER trg_course_enrollment_notify
    AFTER INSERT ON public.course_enrollments
    FOR EACH ROW
    EXECUTE PROCEDURE public.notify_admin_new_enrollment();

-- إن ظهرت رسالة خطأ حول EXECUTE PROCEDURE، جرّب: EXECUTE FUNCTION (PostgreSQL 14+)
-- لتحديث دالة الإشعارات فقط على مشروع قائم: database/notify_enrollment_enrich.sql
