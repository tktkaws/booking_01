-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.bookings (
  id bigint NOT NULL DEFAULT nextval('bookings_id_seq'::regclass),
  title text NOT NULL,
  description text,
  start_at timestamp with time zone NOT NULL,
  end_at timestamp with time zone NOT NULL,
  created_by uuid NOT NULL,
  department text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT bookings_pkey PRIMARY KEY (id),
  CONSTRAINT bookings_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  display_name text NOT NULL,
  email text NOT NULL,
  department text NOT NULL,
  is_admin boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT profiles_pkey PRIMARY KEY (id)
);

| table_name      | ordinal_position | column_name     | data_type                | is_nullable | column_default    |
| --------------- | ---------------- | --------------- | ------------------------ | ----------- | ----------------- |
| bookings        | 1                | id              | bigint                   | NO          | null              |
| bookings        | 2                | title           | text                     | NO          | null              |
| bookings        | 3                | description     | text                     | NO          | ''::text          |
| bookings        | 4                | start_at        | timestamp with time zone | NO          | null              |
| bookings        | 5                | end_at          | timestamp with time zone | NO          | null              |
| bookings        | 6                | created_by      | uuid                     | NO          | null              |
| bookings        | 8                | created_at      | timestamp with time zone | NO          | now()             |
| bookings        | 9                | updated_at      | timestamp with time zone | NO          | now()             |
| departments     | 1                | id              | uuid                     | NO          | gen_random_uuid() |
| departments     | 2                | name            | text                     | NO          | null              |
| departments     | 3                | default_color   | text                     | NO          | '#64748b'::text   |
| departments     | 4                | created_at      | timestamp with time zone | NO          | now()             |
| departments     | 5                | updated_at      | timestamp with time zone | NO          | now()             |
| profiles        | 1                | id              | uuid                     | NO          | null              |
| profiles        | 2                | display_name    | text                     | NO          | null              |
| profiles        | 3                | department_id   | uuid                     | NO          | null              |
| profiles        | 4                | color_settings  | text                     | NO          | ''::text          |
| profiles        | 5                | is_admin        | boolean                  | NO          | false             |
| profiles        | 6                | deleted_at      | timestamp with time zone | YES         | null              |
| profiles        | 7                | created_at      | timestamp with time zone | NO          | now()             |
| profiles        | 8                | updated_at      | timestamp with time zone | NO          | now()             |
| profiles_public | 1                | id              | uuid                     | YES         | null              |
| profiles_public | 2                | display_name    | text                     | YES         | null              |
| profiles_public | 3                | department_id   | uuid                     | YES         | null              |
| profiles_public | 4                | department_name | text                     | YES         | null              |
| profiles_public | 5                | color_settings  | text                     | YES         | null              |



| schemaname | tablename | policyname                     | permissive | roles           | cmd    | qual                                             | with_check                                               |
| ---------- | --------- | ------------------------------ | ---------- | --------------- | ------ | ------------------------------------------------ | -------------------------------------------------------- |
| public     | bookings  | bookings_delete_owner_or_admin | PERMISSIVE | {public}        | DELETE | (viewer_is_admin() OR (created_by = auth.uid())) | null                                                     |
| public     | bookings  | bookings_insert_authenticated  | PERMISSIVE | {authenticated} | INSERT | null                                             | ((auth.uid() IS NOT NULL) AND (created_by = auth.uid())) |
| public     | bookings  | bookings_select_all            | PERMISSIVE | {public}        | SELECT | true                                             | null                                                     |
| public     | bookings  | bookings_update_owner_or_admin | PERMISSIVE | {public}        | UPDATE | (viewer_is_admin() OR (created_by = auth.uid())) | (viewer_is_admin() OR (created_by = auth.uid()))         |
| public     | profiles  | profiles_admin_write           | PERMISSIVE | {public}        | ALL    | viewer_is_admin()                                | viewer_is_admin()                                        |
| public     | profiles  | profiles_insert_self           | PERMISSIVE | {authenticated} | INSERT | null                                             | (id = auth.uid())                                        |
| public     | profiles  | profiles_select_self_or_admin  | PERMISSIVE | {public}        | SELECT | ((id = auth.uid()) OR viewer_is_admin())         | null                                                     |
| public     | profiles  | profiles_update_self           | PERMISSIVE | {public}        | UPDATE | (id = auth.uid())                                | (id = auth.uid())                                        |