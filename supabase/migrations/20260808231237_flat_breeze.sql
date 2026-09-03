/*
  # Revoke EXECUTE on SECURITY DEFINER Functions

  1. Security Fixes
    - Revoke EXECUTE on `public.handle_new_user()` from `anon` role
    - Revoke EXECUTE on `public.handle_new_user()` from `authenticated` role
    - Revoke EXECUTE on `public.update_updated_at()` from `anon` role
    - Revoke EXECUTE on `public.update_updated_at()` from `authenticated` role
    - Lock `search_path` on both functions to `public`

  2. Notes
    - Both functions are internal trigger functions and should never be
      callable directly via the REST API (/rest/v1/rpc/...)
    - They are invoked exclusively by their respective database triggers
*/

-- Fix search_path and recreate update_updated_at
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

-- Fix search_path and recreate handle_new_user
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

-- Revoke EXECUTE from anon role
REVOKE EXECUTE ON FUNCTION public.update_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;

-- Revoke EXECUTE from authenticated role
REVOKE EXECUTE ON FUNCTION public.update_updated_at() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;

-- Revoke EXECUTE from public (covers any other roles inheriting from it)
REVOKE EXECUTE ON FUNCTION public.update_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;