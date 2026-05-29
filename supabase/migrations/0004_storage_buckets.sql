-- Storage buckets for branding logos, gallery, page section images.
-- Public read, super_admin write (RLS).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'public-images',
  'public-images',
  true,
  10485760, -- 10 MB
  array['image/png','image/jpeg','image/webp','image/gif','image/svg+xml']
)
on conflict (id) do nothing;

-- Object policies (storage.objects already has RLS enabled by Supabase).
drop policy if exists "public-images public read"   on storage.objects;
drop policy if exists "public-images super write"   on storage.objects;
drop policy if exists "public-images super update"  on storage.objects;
drop policy if exists "public-images super delete"  on storage.objects;

create policy "public-images public read"
  on storage.objects for select
  using (bucket_id = 'public-images');

create policy "public-images super write"
  on storage.objects for insert
  with check (bucket_id = 'public-images' and is_super_admin());

create policy "public-images super update"
  on storage.objects for update
  using (bucket_id = 'public-images' and is_super_admin())
  with check (bucket_id = 'public-images' and is_super_admin());

create policy "public-images super delete"
  on storage.objects for delete
  using (bucket_id = 'public-images' and is_super_admin());
