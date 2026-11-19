-- Project Check invite-only multi-user test platform
create extension if not exists pgcrypto;

create table public.invites (
  email text primary key check (email = lower(email)),
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  invited_by uuid references auth.users(id)
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  company_name text not null default '',
  business_email text not null,
  mobile_number text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  building_use text,
  site_address text,
  dimensions jsonb not null default '{}'::jsonb,
  stage text not null default 'Stage 1',
  project_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_owner_created_idx on public.projects(owner_id,created_at desc);

create table public.project_events (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  actor_id uuid not null references auth.users(id),
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index project_events_timeline_idx on public.project_events(project_id,occurred_at,id);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  original_name text not null,
  mime_type text,
  size_bytes bigint check (size_bytes>=0),
  uploaded_at timestamptz not null default now()
);

alter table public.invites enable row level security;
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_events enable row level security;
alter table public.documents enable row level security;

create policy "own profile read" on public.profiles for select using (auth.uid()=id);
create policy "own profile update" on public.profiles for update using (auth.uid()=id) with check (auth.uid()=id);
create policy "own profile insert" on public.profiles for insert with check (auth.uid()=id);
create policy "own projects" on public.projects for all using (auth.uid()=owner_id) with check (auth.uid()=owner_id);
create policy "own project history read" on public.project_events for select using (exists(select 1 from public.projects p where p.id=project_id and p.owner_id=auth.uid()));
create policy "own project history append" on public.project_events for insert with check (actor_id=auth.uid() and exists(select 1 from public.projects p where p.id=project_id and p.owner_id=auth.uid()));
create policy "own documents" on public.documents for all using (auth.uid()=owner_id) with check (auth.uid()=owner_id);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('project-documents','project-documents',false,26214400,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/png','image/jpeg'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy "private project document read" on storage.objects for select using (bucket_id='project-documents' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "private project document upload" on storage.objects for insert with check (bucket_id='project-documents' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "private project document delete" on storage.objects for delete using (bucket_id='project-documents' and (storage.foldername(name))[1]=auth.uid()::text);

-- Audit history is append-only: customers can read and append their own events;
-- no UPDATE or DELETE policy is granted.
