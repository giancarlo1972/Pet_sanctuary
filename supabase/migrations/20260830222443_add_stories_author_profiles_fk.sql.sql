-- Add FK from stories.author_id to profiles.id so PostgREST can resolve the profiles!inner join
-- The existing FK points to auth.users(id), which PostgREST can't use for joins
ALTER TABLE stories
  ADD CONSTRAINT stories_author_id_profiles_fkey
  FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE SET NULL;