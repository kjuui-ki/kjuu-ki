-- طلبات شراء الدورات (بعد الدفع عبر Moyasar أو غيره)
-- نفّذ في Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.course_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    total_amount numeric(12, 2) NOT NULL DEFAULT 0,
    currency text NOT NULL DEFAULT 'SAR',
    payment_provider text NOT NULL DEFAULT 'moyasar',
    payment_id text,
    payment_status text NOT NULL DEFAULT 'pending',
    course_ids uuid[] NOT NULL DEFAULT '{}',
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS course_orders_user_id_idx ON public.course_orders(user_id);
CREATE INDEX IF NOT EXISTS course_orders_payment_id_idx ON public.course_orders(payment_id);

ALTER TABLE public.course_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own orders" ON public.course_orders;
CREATE POLICY "Users read own orders" ON public.course_orders
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own orders" ON public.course_orders;
CREATE POLICY "Users insert own orders" ON public.course_orders
    FOR INSERT WITH CHECK (auth.uid() = user_id);
