-- Make school-media storage uploads accessible to all authenticated school members
-- (not just admins/developers). Run once in Supabase SQL Editor if teachers
-- or other staff need to upload student/teacher photos.

drop policy if exists "School managers upload school media" on storage.objects;
create policy "School members upload school media" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'school-media'
    and (storage.foldername(name))[1]::uuid = public.my_school_id()
  );

drop policy if exists "School managers update school media" on storage.objects;
create policy "School members update school media" on storage.objects for update to authenticated
  using (
    bucket_id = 'school-media'
    and (storage.foldername(name))[1]::uuid = public.my_school_id()
  )
  with check (
    bucket_id = 'school-media'
    and (storage.foldername(name))[1]::uuid = public.my_school_id()
  );

drop policy if exists "School managers delete school media" on storage.objects;
create policy "School members delete school media" on storage.objects for delete to authenticated
  using (
    bucket_id = 'school-media'
    and (storage.foldername(name))[1]::uuid = public.my_school_id()
  );