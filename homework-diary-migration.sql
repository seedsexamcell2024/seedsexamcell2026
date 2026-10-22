-- SEEDS Academics Hub: homework diary module.
-- Run in Supabase SQL Editor or apply as migration.

create table if not exists public.homework_diaries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null,
  subject_id uuid not null,
  teacher_id uuid,
  homework_date date not null default current_date,
  topic text not null,
  content text,
  image_paths text[] not null default '{}',
  audio_path text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (class_id, school_id) references public.classes(id, school_id),
  foreign key (subject_id, school_id) references public.subjects(id, school_id),
  foreign key (teacher_id, school_id) references public.teachers(id, school_id)
);
create index if not exists homework_diaries_school_idx on public.homework_diaries (school_id, homework_date desc);
create index if not exists homework_diaries_class_idx on public.homework_diaries (school_id, class_id);

create table if not exists public.homework_receipts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  homework_id uuid not null references public.homework_diaries(id) on delete cascade,
  student_id uuid not null,
  parent_profile_id uuid references auth.users(id),
  confirmed_at timestamptz not null default now(),
  unique (homework_id, student_id),
  foreign key (student_id, school_id) references public.students(id, school_id)
);
create index if not exists homework_receipts_homework_idx on public.homework_receipts (homework_id);

alter table public.homework_diaries enable row level security;
alter table public.homework_receipts enable row level security;

drop policy if exists "School members view homework diaries" on public.homework_diaries;
create policy "School members view homework diaries" on public.homework_diaries for select to authenticated
  using (school_id = public.my_school_id() or public.is_platform_developer());

drop policy if exists "Teachers manage homework diaries" on public.homework_diaries;
create policy "Teachers manage homework diaries" on public.homework_diaries for all to authenticated
  using (
    (school_id = public.my_school_id() and (public.is_school_admin() or public.my_role() = 'teacher' or public.is_platform_developer()))
    or public.is_platform_developer()
  )
  with check (
    (school_id = public.my_school_id() and (public.is_school_admin() or public.my_role() = 'teacher' or public.is_platform_developer()))
    or public.is_platform_developer()
  );

drop policy if exists "School members view homework receipts" on public.homework_receipts;
create policy "School members view homework receipts" on public.homework_receipts for select to authenticated
  using (school_id = public.my_school_id() or public.is_platform_developer());

drop policy if exists "Parents confirm homework receipts" on public.homework_receipts;
create policy "Parents confirm homework receipts" on public.homework_receipts for insert to authenticated
  with check (
    school_id = public.my_school_id()
    and (
      public.is_school_admin()
      or public.is_platform_developer()
      or public.my_role() = 'teacher'
      or exists (
        select 1 from public.parent_students ps
        where ps.parent_profile_id = (select auth.uid())
          and ps.student_id = homework_receipts.student_id
          and ps.school_id = public.my_school_id()
      )
    )
  );

update storage.buckets set
  file_size_limit = 15728640,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','audio/webm','audio/ogg','audio/mpeg','audio/mp4','audio/wav']
where id = 'school-media';

drop policy if exists  School members view school media on storage.objects;
create policy School members view school media on storage.objects for select to authenticated
using (
  bucket_id = 'school-media'
  and (
    public.is_platform_developer()
    or (
      (storage.foldername(name))[1]::uuid = public.my_school_id()
      and (
        (storage.foldername(name))[2] = 'school'
        or (storage.foldername(name))[2] = 'teachers'
        or (storage.foldername(name))[2] = 'homework'
        or (
          (storage.foldername(name))[2] = 'students'
          and case
            when split_part(storage.filename(name), '.', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            then public.can_access_student(split_part(storage.filename(name), '.', 1)::uuid)
            else false
          end
        )
      )
    )
  )
);

drop policy if exists School managers upload school media on storage.objects;
create policy School managers upload school media on storage.objects for insert to authenticated
with check (
  bucket_id = 'school-media'
  and (
    public.can_manage_school((storage.foldername(name))[1]::uuid)
    or (
      (storage.foldername(name))[1]::uuid = public.my_school_id()
      and (storage.foldername(name))[2] = 'homework'
      and (public.is_school_admin() or public.is_platform_developer() or public.my_role() = 'teacher')
    )
  )
);

drop policy if exists School managers update school media on storage.objects;
create policy School managers update school media on storage.objects for update to authenticated
using (
  bucket_id = 'school-media'
  and (
    public.can_manage_school((storage.foldername(name))[1]::uuid)
    or (
      (storage.foldername(name))[1]::uuid = public.my_school_id()
      and (storage.foldername(name))[2] = 'homework'
      and (public.is_school_admin() or public.is_platform_developer() or public.my_role() = 'teacher')
    )
  )
)
with check (
  bucket_id = 'school-media'
  and (
    public.can_manage_school((storage.foldername(name))[1]::uuid)
    or (
      (storage.foldername(name))[1]::uuid = public.my_school_id()
      and (storage.foldername(name))[2] = 'homework'
      and (public.is_school_admin() or public.is_platform_developer() or public.my_role() = 'teacher')
    )
  )
);

drop policy if exists School managers delete school media on storage.objects;
create policy School managers delete school media on storage.objects for delete to authenticated
using (
  bucket_id = 'school-media'
  and (
    public.can_manage_school((storage.foldername(name))[1]::uuid)
    or (
      (storage.foldername(name))[1]::uuid = public.my_school_id()
      and (storage.foldername(name))[2] = 'homework'
      and (public.is_school_admin() or public.is_platform_developer() or public.my_role() = 'teacher')
    )
  )
);

grant select, insert, update, delete on public.homework_diaries, public.homework_receipts to authenticated;
