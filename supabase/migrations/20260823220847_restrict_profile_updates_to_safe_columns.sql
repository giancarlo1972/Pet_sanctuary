-- Users must not be able to grant themselves a privileged role, or change the
-- email their profile is keyed on. Row level security scopes rows, not columns,
-- so the column list is enforced with grants.
REVOKE UPDATE ON public.profiles FROM anon;
REVOKE UPDATE ON public.profiles FROM authenticated;

GRANT UPDATE (full_name, location, avatar_url) ON public.profiles TO authenticated;
