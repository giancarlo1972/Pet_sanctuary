-- Follows: people and orgs a member follows. RLS = own rows only.
-- Run in Supabase SQL Editor. Idempotent.

CREATE TABLE IF NOT EXISTS public.follows (
  follower_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('user', 'organization')),
  target_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS follows_follower_idx ON public.follows (follower_id, created_at DESC);
CREATE INDEX IF NOT EXISTS follows_target_idx ON public.follows (target_type, target_id);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS follows_own ON public.follows;
CREATE POLICY follows_own ON public.follows
  FOR ALL TO authenticated
  USING (follower_id = auth.uid())
  WITH CHECK (follower_id = auth.uid());

GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated;
