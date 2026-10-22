-- Make the school-media storage bucket public so images load via public URLs
-- (signed URLs were failing for some roles/setups). Run once in Supabase SQL Editor.

update storage.buckets
set public = true
where id = 'school-media';
