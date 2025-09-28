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