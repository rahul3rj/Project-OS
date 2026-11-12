-- Run once in the Supabase SQL editor. Only authenticated users can read their
-- own snapshot; writes go through a revision-checked function.
create table if not exists public.cloud_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 1,
  snapshot jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.cloud_snapshots enable row level security;
revoke all on public.cloud_snapshots from anon, authenticated;
grant select on public.cloud_snapshots to authenticated;
drop policy if exists "read own cloud snapshot" on public.cloud_snapshots;
create policy "read own cloud snapshot" on public.cloud_snapshots for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.save_cloud_snapshot(expected_revision bigint, new_snapshot jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); next_revision bigint;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if new_snapshot is null or jsonb_typeof(new_snapshot) <> 'object'
     or new_snapshot->>'version' is distinct from '1'
     or jsonb_typeof(new_snapshot->'data') is distinct from 'object'
     or pg_column_size(new_snapshot) > 1048576 then
    raise exception 'Invalid or oversized snapshot';
  end if;
  if expected_revision = 0 then
    insert into public.cloud_snapshots(user_id, snapshot) values (uid, new_snapshot)
      on conflict (user_id) do nothing returning revision into next_revision;
  else
    update public.cloud_snapshots set snapshot = new_snapshot, revision = revision + 1, updated_at = now()
      where user_id = uid and revision = expected_revision returning revision into next_revision;
  end if;
  if next_revision is null then raise exception 'cloud_revision_conflict'; end if;
  return next_revision;
end $$;
revoke all on function public.save_cloud_snapshot(bigint, jsonb) from public, anon;
grant execute on function public.save_cloud_snapshot(bigint, jsonb) to authenticated;
