-- An applicant must not be able to approve their own adoption application.
-- Only the free-text message stays client-writable; status changes belong to
-- shelter staff through privileged server-side paths.
REVOKE UPDATE ON public.adoption_applications FROM anon;
REVOKE UPDATE ON public.adoption_applications FROM authenticated;

GRANT UPDATE (message) ON public.adoption_applications TO authenticated;
