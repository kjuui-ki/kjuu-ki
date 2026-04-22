-- ════════════════════════════════════════════════════════════════
-- admin_promotion_requests
-- طلبات ترقية مستخدم إلى دور super_admin
-- ترسل من أي أدمن ثانوي → تُعرض على الأدمن الرئيسي kramabid1@gmail.com
-- ════════════════════════════════════════════════════════════════

create table if not exists admin_promotion_requests (
    id             uuid        default gen_random_uuid() primary key,
    requested_by   uuid        not null references profiles(id) on delete cascade,   -- الأدمن الذي قدّم الطلب
    target_user_id uuid        not null references profiles(id) on delete cascade,   -- المستخدم المراد ترقيته
    status         text        not null default 'pending'
                               check (status in ('pending', 'approved', 'rejected')),
    notes          text,
    created_at     timestamptz default now()
);

-- RLS
alter table admin_promotion_requests enable row level security;

-- أي super_admin يمكنه إدراج طلب
create policy "super_admin can insert promo requests"
    on admin_promotion_requests for insert
    to authenticated
    with check (
        exists (
            select 1 from profiles
            where id = auth.uid() and role = 'super_admin'
        )
    );

-- أي super_admin يمكنه قراءة الطلبات
create policy "super_admin can read promo requests"
    on admin_promotion_requests for select
    to authenticated
    using (
        exists (
            select 1 from profiles
            where id = auth.uid() and role = 'super_admin'
        )
    );

-- أي super_admin يمكنه تحديث الحالة (الموافقة / الرفض)
create policy "super_admin can update promo requests"
    on admin_promotion_requests for update
    to authenticated
    using (
        exists (
            select 1 from profiles
            where id = auth.uid() and role = 'super_admin'
        )
    );
