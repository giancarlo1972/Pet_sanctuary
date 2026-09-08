-- Home "Trending now" is public. Open/pinned community needs are readable without a session.
DROP POLICY IF EXISTS cn_read ON community_needs;
CREATE POLICY cn_read ON community_needs FOR SELECT TO anon, authenticated
  USING (status IN ('open', 'pinned'));
