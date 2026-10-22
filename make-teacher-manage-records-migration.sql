-- Allow teachers to manage student and teacher records in their school.
-- Run once in Supabase SQL Editor if non-admin staff need to save records.

-- Students: teachers can insert/update/delete students in their school
drop policy if exists "Teachers manage students" on public.students;
create policy "Teachers manage students" on public.students for all to authenticated
  using (school_id = public.my_school_id() and public.my_role() = 'teacher')
  with check (school_id = public.my_school_id() and public.my_role() = 'teacher');

-- Teachers: teachers can insert/update/delete teachers in their school
drop policy if exists "Teachers manage teachers" on public.teachers;
create policy "Teachers manage teachers" on public.teachers for all to authenticated
  using (school_id = public.my_school_id() and public.my_role() = 'teacher')
  with check (school_id = public.my_school_id() and public.my_role() = 'teacher');