-- ── جدول طلبات فتح الدورات من الشركات ───────────────────────────
create table if not exists public.course_requests (
    id              uuid primary key default gen_random_uuid(),
    company_id      uuid not null references auth.users(id) on delete cascade,
    course_name     text not null,                -- اسم الدورة المطلوبة
    target_audience text,                         -- الفئة المستهدفة (موظفون، متدربون…)
    expected_date   date,                         -- التاريخ المتوقع لبدء الدورة
    duration        text,                         -- مثال: "3 أيام" أو "40 ساعة"
    seats           integer default 1,            -- عدد المقاعد المطلوبة
    category        text,                         -- المجال: تقنية، مالية…
    description     text,                         -- وصف تفصيلي ومتطلبات
    notes           text,                         -- ملاحظات إضافية
    status          text not null default 'pending'
                    check (status in ('pending', 'approved', 'rejected')),
    created_at      timestamptz not null default now()
);

alter table public.course_requests disable row level security;
