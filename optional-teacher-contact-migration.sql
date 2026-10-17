-- Allow teacher directory records without an email address.
-- Phone numbers are already nullable.
alter table public.teachers alter column email drop not null;
