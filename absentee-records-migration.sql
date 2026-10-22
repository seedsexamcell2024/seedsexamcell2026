-- SEEDS Academics Hub: daily absentee records.
create table if not exists public.absentee_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  report_date date not null default current_date,
  class_id uuid not null,
  student_id uuid not null,
  status text not null default 'absent',
  created_at timestamptz not null default now(),
  unique (school_id, student_id, report_date),
  foreign key (student_id, school_id) references public.students(id, school_id) on delete cascade,
  foreign key (class_id, school_id) references public.classes(id, school_id) on delete cascade
);
create index if not exists absentee_records_school_date_idx on public.absentee_records (school_id, report_date);
create index if not exists absentee_records_class_date_idx on public.absentee_records (school_id, class_id, report_date);

alter table public.absentee_records enable row level security;

drop policy if exists "School members view absentee records" on public.absentee_records;
create policy "School members view absentee records" on public.absentee_records for select to authenticated
  using (school_id = public.my_school_id() or public.is_platform_developer());

drop policy if exists "Managers save absentee records" on public.absentee_records;
create policy "Managers save absentee records" on public.absentee_records for all to authenticated
  using (
    (school_id = public.my_school_id() and (public.is_school_admin() or public.my_role() = 'teacher' or public.is_platform_developer()))
    or public.is_platform_developer()
  )
  with check (
    (school_id = public.my_school_id() and (public.is_school_admin() or public.my_role() = 'teacher' or public.is_platform_developer()))
    or public.is_platform_developer()
  );

grant select, insert, update, delete on public.absentee_records to authenticated;
