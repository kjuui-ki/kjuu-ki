-- ═══════════════════════════════════════════════════════════════════════════
-- إصلاح «عرض المسجلين» في لوحة التحكم
-- الصق هذا الملف كاملاً في: Supabase → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════════════════

GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_enrollments TO authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.courses TO authenticated;

DROP POLICY IF EXISTS "enrollments_select" ON public.course_enrollments;
DROP POLICY IF EXISTS "enrollments_insert" ON public.course_enrollments;
DROP POLICY IF EXISTS "enrollments_update" ON public.course_enrollments;
DROP POLICY IF EXISTS "enrollments_delete" ON public.course_enrollments;
DROP POLICY IF EXISTS "Users can read own enrollments" ON public.course_enrollments;
DROP POLICY IF EXISTS "Users can insert own enrollments" ON public.course_enrollments;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.course_enrollments;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.course_enrollments;

ALTER TABLE public.course_enrollments DISABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.admin_list_course_enrollments(p_course_id uuid)
RETURNS TABLE (
    user_id uuid,
    status text,
    created_at timestamptz,
    full_name text,
    email text,
    phone text,
    role text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
          AND role = 'super_admin'
    ) THEN
        RAISE EXCEPTION 'not allowed';
    END IF;

    RETURN QUERY
    SELECT
        e.user_id,
        e.status,
        e.created_at,
        p.full_name,
        p.email,
        p.phone,
        p.role
    FROM public.course_enrollments e
    LEFT JOIN public.profiles p ON p.id = e.user_id
    WHERE e.course_id = p_course_id
    ORDER BY e.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_course_enrollments(uuid) TO authenticated;
