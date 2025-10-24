-- 10 rows seed for public.bookings (no functions, fixed timestamps)
-- IMPORTANT: Replace edb5d1d6-1e37-4051-bee2-0d5c18f305d5 with an existing public.profiles.id
-- RLS: If enabled, run as the same authenticated user as PROFILE_UUID_HERE

insert into public.bookings (title, description, start_at, end_at, created_by) values
-- 2025-01-13 (Mon)
('打合せ 01', '', timestamptz '2025-01-13 10:00+09', timestamptz '2025-01-13 10:30+09', 'edb5d1d6-1e37-4051-bee2-0d5c18f305d5'),
('打合せ 02', '', timestamptz '2025-01-13 14:00+09', timestamptz '2025-01-13 14:30+09', 'edb5d1d6-1e37-4051-bee2-0d5c18f305d5'),
-- 2025-01-14 (Tue)
('打合せ 03', '', timestamptz '2025-01-14 09:30+09', timestamptz '2025-01-14 10:00+09', 'edb5d1d6-1e37-4051-bee2-0d5c18f305d5'),
('打合せ 04', '', timestamptz '2025-01-14 15:00+09', timestamptz '2025-01-14 15:30+09', 'edb5d1d6-1e37-4051-bee2-0d5c18f305d5'),
-- 2025-01-15 (Wed)
('打合せ 05', '', timestamptz '2025-01-15 11:00+09', timestamptz '2025-01-15 11:30+09', 'edb5d1d6-1e37-4051-bee2-0d5c18f305d5'),
('打合せ 06', '', timestamptz '2025-01-15 16:00+09', timestamptz '2025-01-15 16:30+09', 'edb5d1d6-1e37-4051-bee2-0d5c18f305d5'),
-- 2025-01-16 (Thu)
('打合せ 07', '', timestamptz '2025-01-16 10:30+09', timestamptz '2025-01-16 11:00+09', 'edb5d1d6-1e37-4051-bee2-0d5c18f305d5'),
('打合せ 08', '', timestamptz '2025-01-16 14:30+09', timestamptz '2025-01-16 15:00+09', 'edb5d1d6-1e37-4051-bee2-0d5c18f305d5'),
-- 2025-01-17 (Fri)
('打合せ 09', '', timestamptz '2025-01-17 09:00+09', timestamptz '2025-01-17 09:30+09', 'edb5d1d6-1e37-4051-bee2-0d5c18f305d5'),
('打合せ 10', '', timestamptz '2025-01-17 13:30+09', timestamptz '2025-01-17 14:00+09', 'edb5d1d6-1e37-4051-bee2-0d5c18f305d5');

-- All rows obey 15-min increments and fall within 9:00–18:00 JST.
