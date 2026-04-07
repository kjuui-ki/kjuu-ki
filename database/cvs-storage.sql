insert into storage.buckets (id, name, public)
values ('cvs', 'cvs', true)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public;

drop policy if exists "Authenticated users can upload CVs" on storage.objects;
create policy "Authenticated users can upload CVs"
    on storage.objects
    for insert
    to authenticated
    with check (bucket_id = 'cvs');

drop policy if exists "Authenticated users can read CVs" on storage.objects;
create policy "Authenticated users can read CVs"
    on storage.objects
    for select
    to authenticated
    using (bucket_id = 'cvs');
