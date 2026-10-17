-- Add a separate attendance register for each class/subject assignment.
-- Run this once in the Supabase SQL Editor when upgrading an existing app.

create table if not exists public.subject_attendance (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null,
  class_id uuid not null,
  subject_id uuid not null,
  attendance_date date not null default current_date,
  status text not null check (status in ('present', 'absent', 'leave', 'holiday')),
  recorded_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  unique (student_id, subject_id, attendance_date),
  foreign key (student_id, school_id) references public.students(id, school_id) on delete cascade,
  foreign key (class_id, school_id) references public.classes(id, school_id) on delete cascade,
  foreign key (subject_id, school_id) references public.subjects(id, school_id) on delete cascade
);

create index if not exists subject_attendance_school_date_idx
  on public.subject_attendance (school_id, attendance_date);

create or replace function public.validate_subject_attendance_record()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  student_class uuid;
begin
  select s.class_id into student_class
  from public.students s
  where s.id = new.student_id and s.school_id = new.school_id;

  if student_class is null or student_class <> new.class_id then
    raise exception 'Attendance class must match the student class.';
  end if;
  if not exists (
    select 1 from public.class_subjects cs
    where cs.school_id = new.school_id
      and cs.class_id = new.class_id
      and cs.subject_id = new.subject_id
  ) then
    raise exception 'Subject attendance must match an assigned class subject.';
  end if;
  return new;
end
$$;

drop trigger if exists subject_attendance_assignment_guard on public.subject_attendance;
create trigger subject_attendance_assignment_guard
before insert or update of student_id, class_id, subject_id, school_id on public.subject_attendance
for each row execute function public.validate_subject_attendance_record();

alter table public.subject_attendance enable row level security;

drop policy if exists "Users read assigned subject attendance" on public.subject_attendance;
create policy "Users read assigned subject attendance" on public.subject_attendance for select to authenticated using (
  school_id = public.my_school_id()
  and (
    public.is_school_admin()
    or exists (
      select 1 from public.class_subjects cs
      where cs.school_id = subject_attendance.school_id
        and cs.class_id = subject_attendance.class_id
        and cs.subject_id = subject_attendance.subject_id
        and cs.teacher_id = public.my_teacher_id()
        and public.my_role() = 'teacher'
    )
    or (
      public.my_role() in ('student', 'parent')
      and public.can_access_student(subject_attendance.student_id)
    )
  )
);

drop policy if exists "Assigned subject teachers record attendance" on public.subject_attendance;
create policy "Assigned subject teachers record attendance" on public.subject_attendance for insert to authenticated with check (
  school_id = public.my_school_id()
  and recorded_by = (select auth.uid())
  and (
    public.is_school_admin()
    or (
      public.my_role() = 'teacher'
      and exists (
        select 1
        from public.class_subjects cs
        join public.students s on s.id = subject_attendance.student_id and s.school_id = subject_attendance.school_id
        where cs.school_id = subject_attendance.school_id
          and cs.class_id = subject_attendance.class_id
          and cs.subject_id = subject_attendance.subject_id
          and cs.teacher_id = public.my_teacher_id()
          and s.class_id = subject_attendance.class_id
      )
    )
  )
);

drop policy if exists "Assigned subject teachers update attendance" on public.subject_attendance;
create policy "Assigned subject teachers update attendance" on public.subject_attendance for update to authenticated using (
  school_id = public.my_school_id()
  and (
    public.is_school_admin()
    or (
      public.my_role() = 'teacher'
      and exists (
        select 1 from public.class_subjects cs
        where cs.school_id = subject_attendance.school_id
          and cs.class_id = subject_attendance.class_id
          and cs.subject_id = subject_attendance.subject_id
          and cs.teacher_id = public.my_teacher_id()
      )
    )
  )
) with check (
  school_id = public.my_school_id()
  and (
    public.is_school_admin()
    or (
      public.my_role() = 'teacher'
      and exists (
        select 1
        from public.class_subjects cs
        join public.students s on s.id = subject_attendance.student_id and s.school_id = subject_attendance.school_id
        where cs.school_id = subject_attendance.school_id
          and cs.class_id = subject_attendance.class_id
          and cs.subject_id = subject_attendance.subject_id
          and cs.teacher_id = public.my_teacher_id()
          and s.class_id = subject_attendance.class_id
      )
    )
  )
);

drop policy if exists "Admins delete subject attendance" on public.subject_attendance;
create policy "Admins delete subject attendance" on public.subject_attendance for delete to authenticated using (
  school_id = public.my_school_id() and public.is_school_admin()
);

drop policy if exists "Developers manage all subject attendance" on public.subject_attendance;
create policy "Developers manage all subject attendance" on public.subject_attendance for all to authenticated
  using (public.is_platform_developer()) with check (public.is_platform_developer());

grant select, insert, update, delete on public.subject_attendance to authenticated;
