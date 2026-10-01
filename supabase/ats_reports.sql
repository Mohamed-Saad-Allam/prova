-- =========================================================================
-- ATS Semantic Reports Table Migration
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- =========================================================================

create table if not exists ats_reports (
  id uuid default gen_random_uuid() primary key,
  cv_id uuid references cvs(id) on delete cascade,
  job_description text not null,
  score int not null,
  missing_skills text,
  created_at timestamp default now()
);

-- Enable Row Level Security (RLS)
alter table ats_reports enable row level security;

-- Allow reading and inserting reports
create policy "Allow public read ats_reports" on ats_reports
  for select using (true);

create policy "Allow public insert ats_reports" on ats_reports
  for insert with check (true);
