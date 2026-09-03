/*
  # Fix Function Security Issues (Final)

  1. Changes
    - Lock `search_path` on `update_updated_at` to prevent mutable search path vulnerability
    - Lock `search_path` on `handle_new_user` to prevent mutable search path vulnerability
    - Revoke EXECUTE on `handle_new_user` from `anon` role
    - Revoke EXECUTE on `handle_new_user` from `authenticated` role

  2. Security
    - Both functions now use SET search_path = public
    - `handle_new_user` is only callable by the internal auth trigger
*/

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;