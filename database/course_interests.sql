-- اهتمامات الدورات (سجّل اهتمامك بالدورة)
-- نفّذ في Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.course_interests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    full_name text NOT NULL,
    phone text NOT NULL,
    course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    course_title text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS course_interests_course_id_idx ON public.course_interests(course_id);
CREATE INDEX IF NOT EXISTS course_interests_created_at_idx ON public.course_interests(created_at DESC);
CREATE INDEX IF NOT EXISTS course_interests_phone_idx ON public.course_interests(phone);

CREATE UNIQUE INDEX IF NOT EXISTS course_interests_user_course_uidx
    ON public.course_interests(user_id, course_id)
    WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS course_interests_phone_course_uidx
    ON public.course_interests(phone, course_id)
    WHERE user_id IS NULL;

ALTER TABLE public.course_interests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can register course interest" ON public.course_interests;
CREATE POLICY "Anyone can register course interest" ON public.course_interests
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users read own course interests" ON public.course_interests;
CREATE POLICY "Users read own course interests" ON public.course_interests
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins read course interests" ON public.course_interests;
CREATE POLICY "Admins read course interests" ON public.course_interests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = 'super_admin'
        )
    );

DROP POLICY IF EXISTS "Admins delete course interests" ON public.course_interests;
CREATE POLICY "Admins delete course interests" ON public.course_interests
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = 'super_admin'
        )
    );
