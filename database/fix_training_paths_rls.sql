-- ═══════════════════════════════════════════════════════════════════════════
-- إصلاح: تعذّر الاستيراد — new row violates row-level security policy
-- نفّذ هذا الملف كاملاً في Supabase → SQL Editor (مرة واحدة) ثم أعد الاستيراد
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) صلاحيات الجداول (مهم حتى مع RLS معطّل)
GRANT SELECT ON public.training_paths TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.training_paths TO authenticated;

GRANT SELECT ON public.courses TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.courses TO authenticated;

GRANT SELECT, INSERT, UPDATE ON public.admin_notifications TO authenticated;
GRANT SELECT, INSERT ON public.course_enrollments TO authenticated;

-- 2) إزالة سياسات RLS القديمة (إن وُجدت)
DROP POLICY IF EXISTS "public_read_active_training_paths" ON public.training_paths;
DROP POLICY IF EXISTS "authenticated_manage_training_paths" ON public.training_paths;
DROP POLICY IF EXISTS "admin_manage_training_paths" ON public.training_paths;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.training_paths;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.training_paths;

DROP POLICY IF EXISTS "public_read_active_courses" ON public.courses;
DROP POLICY IF EXISTS "authenticated_manage_courses" ON public.courses;
DROP POLICY IF EXISTS "admin_manage_courses" ON public.courses;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.courses;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.courses;

-- 3) الحل الأبسط (مثل المشروع الأصلي): تعطيل RLS على كتالوج المسارات والدورات
--    يسمح للأدمن بالاستيراد من لوحة التحكم وللزوار بالقراءة عبر الموقع
ALTER TABLE public.training_paths DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_enrollments DISABLE ROW LEVEL SECURITY;

-- 4) بعد هذا الملف: نفّذ seed_training_catalog.sql (أو زر «استيراد 17 مساراً»)
