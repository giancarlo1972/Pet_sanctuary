-- Public service-provider directory. Owner rights so signed-out visitors
-- can read names and services without opening profiles.
-- Run in Supabase SQL Editor. Idempotent.

DROP VIEW IF EXISTS public.public_service_providers;
CREATE VIEW public.public_service_providers
WITH (security_invoker = false) AS
SELECT
  spp.user_id,
  p.full_name,
  p.avatar_url,
  spp.services,
  COALESCE(p.volunteer_active, false) AS is_volunteer,
  spp.rating,
  spp.reviews_count,
  spp.radius_mi,
  spp.show_on_map
FROM public.service_provider_profiles spp
JOIN public.profiles p ON p.id = spp.user_id;

GRANT SELECT ON public.public_service_providers TO anon, authenticated;
