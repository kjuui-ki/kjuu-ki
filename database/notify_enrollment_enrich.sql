-- إثراء إشعار التسجيل باسم المسار (نفّذ في Supabase بعد training_paths_migration.sql)
-- يحدّث جسم الإشعار وmeta.training_path_name

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
