-- Seed bookings without overlaps, 15-min increments, JST business hours
-- Prerequisites:
--   - departments: at least 1 row
--   - profiles: at least 1 row with department_id set (RLS allows authenticated insert/select)
-- Behavior:
--   - Picks up to 5 profiles (round-robin with 5 time slots)
--   - Finds next 5 weekdays from today (JST) and inserts 1 booking per slot per day (max 25)

with pairs as (
  select
    p.id as created_by,
    row_number() over (order by p.display_name nulls last, p.id) as idx
  from public.profiles p
  limit 5
),
days as (
  select d::date as d
  from generate_series(current_date, current_date + interval '14 day', interval '1 day') g(d)
  where extract(isodow from d) between 1 and 5
  limit 5
),
times as (
  -- 5 slots: 09:00–09:30, 10:00–10:30, 11:00–11:30, 14:00–14:30, 15:00–15:30 (JST)
  select * from (
    values
      (time '09:00', time '09:30', 1),
      (time '10:00', time '10:30', 2),
      (time '11:00', time '11:30', 3),
      (time '14:00', time '14:30', 4),
      (time '15:00', time '15:30', 5)
  ) as t(start_time, end_time, idx)
)
insert into public.bookings (title, description, start_at, end_at, created_by)
select
  format('打合せ %s %s', to_char(d.d, 'MM/DD'), to_char(t.start_time, 'HH24:MI')) as title,
  '' as description,
  -- Compose timestamptz explicitly in JST to satisfy constraints
  to_timestamp((d.d::text || ' ' || t.start_time::text), 'YYYY-MM-DD HH24:MI') at time zone 'Asia/Tokyo',
  to_timestamp((d.d::text || ' ' || t.end_time::text),   'YYYY-MM-DD HH24:MI') at time zone 'Asia/Tokyo',
  p.created_by
from days d
join times t on true
join pairs p on p.idx = t.idx
order by d.d, t.start_time;

-- Notes:
-- - If you previously used department-scoped exclusion constraints, adjust them to global scope.
-- - If there are fewer than 5 profiles, fewer rows will be inserted (matching idx).
-- - RLS: run with an authenticated session or service role to bypass RLS.
