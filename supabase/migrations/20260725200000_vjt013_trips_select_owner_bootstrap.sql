-- VJT-013: fix an RLS bootstrap deadlock in trip creation, found while
-- building the first real (non-mocked) RLS test for this project.
--
-- trips_select only allowed is_trip_member(id). A brand-new trip has no
-- trip_members row yet, so this blocked:
--   1. `supabase.from("trips").insert(...).select("id")` in useCreateTrip.ts
--      -- INSERT ... RETURNING re-applies the table's SELECT policy to the
--      new row, which failed for the trip's own creator.
--   2. The EXISTS(select ... from trips ...) subquery inside the owner path
--      of members_insert_self_owner -- itself filtered by trips_select, so
--      the owner's very first trip_members row could never be inserted
--      either.
-- Letting a trip's owner see their own trip directly breaks the circular
-- dependency; is_trip_member(id) becomes true moments later once the
-- owner's trip_members row is inserted, so this only widens visibility for
-- the single instant between trip creation and membership bootstrap.
alter policy trips_select on public.trips
  using (is_trip_member(id) or owner_id = auth.uid());

-- Second half of the same change: freeze trips.owner_id against members.
--
-- trips_update was `using (is_trip_member(id))` with NO with_check, and in
-- Postgres an UPDATE policy without with_check reuses its using expression --
-- which only constrains `id`, never `owner_id`. So any editor could run
-- `update trips set owner_id = <themselves>`.
--
-- That was harmless before the change above: is_trip_owner() reads
-- trip_members.role, not trips.owner_id, so rewriting owner_id granted
-- nothing. Adding `or owner_id = auth.uid()` to trips_select is what makes
-- owner_id load-bearing for reads -- without this second half, an editor
-- could self-assign owner_id and keep seeing the trips row forever after
-- leaving the trip. The escalation is created by this migration, so it is
-- closed by this migration.
--
-- trip_owner_id() is security definer for the same reason is_trip_member()
-- and is_trip_owner() are: the lookup must not be filtered by the very
-- policies being evaluated. A plain `(select owner_id from trips ...)`
-- subquery happens to work today, but it reads through trips_select, so any
-- future tightening of the read policy would silently start rejecting
-- legitimate updates.
create or replace function public.trip_owner_id(p_trip_id uuid)
returns uuid language sql security definer set search_path = public stable as $$
  select owner_id from public.trips where id = p_trip_id;
$$;

alter policy trips_update on public.trips
  using (is_trip_member(id))
  with check (is_trip_member(id) and owner_id = public.trip_owner_id(id));
