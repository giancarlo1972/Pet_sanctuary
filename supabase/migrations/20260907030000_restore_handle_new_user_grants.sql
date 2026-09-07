-- Restore Auth trigger so new signups can create profiles.
-- The Aug 8 security migration revoked EXECUTE FROM PUBLIC, which also
-- blocked supabase_auth_admin when creating a user.

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.update_updated_at() TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres;
GRANT EXECUTE ON FUNCTION public.update_updated_at() TO postgres;
