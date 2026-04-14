-- ── جدول الدورات التدريبية ──────────────────────────────────────────
create table if not exists public.courses (
    id          uuid primary key default gen_random_uuid(),
    title       text not null,
    description text,
    instructor  text,
    duration    text,          -- مثال: "10 ساعات" أو "3 أسابيع"
    category    text,
    max_seats   integer default 0,   -- 0 = غير محدود
    created_by  uuid references auth.users(id) on delete set null,
    is_active   boolean not null default true,
    created_at  timestamptz not null default now()
);

-- تعطيل RLS ليتماشى مع باقي الجداول
alter table public.courses disable row level security;

-- ── جدول تسجيل الدورات ──────────────────────────────────────────────
create table if not exists public.course_enrollments (
    id          uuid primary key default gen_random_uuid(),
    course_id   uuid not null references public.courses(id) on delete cascade,
    user_id     uuid not null references auth.users(id) on delete cascade,
    enrolled_by uuid references auth.users(id) on delete set null,
    -- null = سجّل نفسه، أو يحتوي على id الشركة التي سجلت موظفها
    status      text not null default 'enrolled'
                check (status in ('enrolled', 'completed', 'cancelled')),
    created_at  timestamptz not null default now(),
    unique(course_id, user_id)
);

alter table public.course_enrollments disable row level security;
