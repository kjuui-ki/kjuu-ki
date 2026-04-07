create table if not exists public.applications (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    job_id uuid not null references public.jobs(id) on delete cascade,
    full_name text,
    phone text,
    specialization text,
    skills text,
    cv_url text,
    status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
    created_at timestamptz not null default now()
);

alter table public.applications
    add column if not exists full_name text,
    add column if not exists phone text,
    add column if not exists specialization text,
    add column if not exists skills text,
    add column if not exists cv_url text;

alter table public.applications
    alter column status set default 'pending';

create unique index if not exists applications_job_user_unique
    on public.applications (job_id, user_id);

alter table public.applications enable row level security;

drop policy if exists "Applicants can read their applications" on public.applications;
create policy "Applicants can read their applications"
    on public.applications
    for select
    using (auth.uid() = user_id);

drop policy if exists "Applicants can insert their applications" on public.applications;
create policy "Applicants can insert their applications"
    on public.applications
    for insert
    with check (auth.uid() = user_id);
