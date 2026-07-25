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
