/*
  # Fix Function Security Issues

  1. Changes
    - Set immutable `search_path` on `update_updated_at` to prevent mutable search path vulnerability
    - Set immutable `search_path` on `handle_new_user` to prevent mutable search path vulnerability
    - Revoke EXECUTE on `handle_new_user` from `anon` and `authenticated` roles to prevent unauthorized SECURITY DEFINER execution
*/

-- Fix search_path for update_updated_at
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

-- Fix search_path for handle_new_user and restrict execution
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

-- Revoke execute permissions from anon and authenticated roles
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;