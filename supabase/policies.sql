-- =============================================================================
-- Row Level Security, auth wiring, and triggers.
--
-- Drizzle owns the tables (supabase/migrations); this file owns everything
-- Drizzle can't express. It is idempotent — re-run it after any migration.
--
--   npm run db:policies
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Local-development shim.
--
-- Supabase already provides the `auth` schema, `auth.users`, and `auth.uid()`.
-- A plain Postgres instance does not, so create just enough of it to let the
-- same policies compile locally. On Supabase these blocks all no-op.
-- -----------------------------------------------------------------------------

create schema if not exists auth;

do $$
begin
  if to_regclass('auth.users') is null then
    create table auth.users (
      id uuid primary key default gen_random_uuid(),
      email text unique,
      created_at timestamptz not null default now()
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'auth' and p.proname = 'uid'
  ) then
    execute $fn$
      create function auth.uid() returns uuid
      language sql stable
      as 'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
    $fn$;
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- profiles <-> auth.users
-- -----------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_id_auth_users_fk'
  ) then
    alter table public.profiles
      add constraint profiles_id_auth_users_fk
      foreign key (id) references auth.users (id) on delete cascade;
  end if;
end
$$;

-- A profile is created the moment someone signs up, so `founder_id` is never
-- dangling and handles are claimed atomically.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_handle text;
  final_handle text;
  suffix int := 0;
begin
  base_handle := regexp_replace(
    lower(coalesce(
      new.raw_user_meta_data ->> 'user_name',
      new.raw_user_meta_data ->> 'preferred_username',
      split_part(coalesce(new.email, 'founder'), '@', 1)
    )),
    '[^a-z0-9]+', '', 'g'
  );

  if base_handle is null or length(base_handle) < 3 then
    base_handle := 'founder';
  end if;

  final_handle := left(base_handle, 24);

  while exists (select 1 from public.profiles where handle = final_handle) loop
    suffix := suffix + 1;
    final_handle := left(base_handle, 20) || suffix::text;
  end loop;

  insert into public.profiles (id, handle, name, avatar_url)
  values (
    new.id,
    final_handle,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

do $$
begin
  -- `raw_user_meta_data` only exists on Supabase's auth.users.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'auth' and table_name = 'users'
      and column_name = 'raw_user_meta_data'
  ) then
    drop trigger if exists on_auth_user_created on auth.users;
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- updated_at
-- -----------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['profiles', 'apps', 'revenue_connections'] loop
    execute format('drop trigger if exists touch_updated_at on public.%I', t);
    execute format(
      'create trigger touch_updated_at before update on public.%I
       for each row execute function public.touch_updated_at()', t);
  end loop;
end
$$;

-- -----------------------------------------------------------------------------
-- Row Level Security
--
-- Reads are public but scoped to live apps. Writes are owner-only. The service
-- role bypasses RLS entirely, which is how the sync job reaches everything.
-- -----------------------------------------------------------------------------

alter table public.profiles            enable row level security;
alter table public.categories          enable row level security;
alter table public.tech_stack_tags     enable row level security;
alter table public.apps                enable row level security;
alter table public.app_tech_stack      enable row level security;
alter table public.app_store_metadata  enable row level security;
alter table public.revenue_connections enable row level security;
alter table public.revenue_snapshots   enable row level security;
alter table public.app_metrics         enable row level security;
alter table public.follows             enable row level security;
alter table public.app_views           enable row level security;

do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies where schemaname = 'public'
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$$;

-- Reference data: readable by anyone, writable only by the service role.
create policy categories_read      on public.categories      for select using (true);
create policy tech_stack_tags_read on public.tech_stack_tags for select using (true);

-- Profiles are public pages.
create policy profiles_read on public.profiles for select using (true);
create policy profiles_update_own on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- Apps: everyone sees live listings; founders also see their own drafts.
create policy apps_read_live on public.apps for select
  using (status = 'live' or founder_id = auth.uid());
create policy apps_insert_own on public.apps for insert
  with check (founder_id = auth.uid());
create policy apps_update_own on public.apps for update
  using (founder_id = auth.uid()) with check (founder_id = auth.uid());
create policy apps_delete_own on public.apps for delete
  using (founder_id = auth.uid());

-- Everything hanging off an app inherits that app's visibility.
create or replace function public.can_read_app(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.apps a
    where a.id = target and (a.status = 'live' or a.founder_id = auth.uid())
  );
$$;

create or replace function public.owns_app(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.apps a where a.id = target and a.founder_id = auth.uid());
$$;

create policy app_tech_stack_read on public.app_tech_stack for select
  using (public.can_read_app(app_id));
create policy app_tech_stack_write on public.app_tech_stack for all
  using (public.owns_app(app_id)) with check (public.owns_app(app_id));

create policy app_store_metadata_read on public.app_store_metadata for select
  using (public.can_read_app(app_id));

create policy revenue_snapshots_read on public.revenue_snapshots for select
  using (public.can_read_app(app_id));

create policy app_metrics_read on public.app_metrics for select
  using (public.can_read_app(app_id));

create policy app_views_read on public.app_views for select
  using (public.can_read_app(app_id));

create policy follows_read on public.follows for select using (true);
create policy follows_write_own on public.follows for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- revenue_connections deliberately has NO policy.
--
-- RLS is on and nothing grants access, so anon and authenticated roles cannot
-- read, insert, or update a single row — including the founders who own them.
-- Provider credentials are reachable only through server code holding the
-- service-role key. Do not add a policy here.
