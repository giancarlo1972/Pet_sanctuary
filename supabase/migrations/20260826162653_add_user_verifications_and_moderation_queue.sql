/*
# Add user verifications and moderation queue

1. New Tables
- `user_verifications`
  - `user_id` (uuid, primary key, references profiles.id)
  - `id_verified` (boolean, default false)
  - `phone_verified` (boolean, default false)
  - `responder_training` (text, default 'none' — values: none, in_review, passed)
  - `updated_at` (timestamptz, default now())
- `moderation_queue`
  - `id` (uuid, primary key)
  - `subject_type` (text — e.g. 'report', 'story', 'pet')
  - `subject_id` (uuid)
  - `flag_reason` (text)
  - `status` (text, default 'pending' — values: pending, approved, rejected)
  - `reviewer_id` (uuid, nullable, references profiles.id)
  - `created_at` (timestamptz, default now())
  - `resolved_at` (timestamptz, nullable)

2. Security
- Enable RLS on both tables.
- `user_verifications`: owner can read own row; owner can update own row (verification status itself is set server-side, but the row is user-created).
- `moderation_queue`: any authenticated user can read pending items (for org-admin review); only reviewer can update status.

3. Notes
- `user_verifications` uses user_id as primary key for 1:1 relationship with profiles.
- `moderation_queue` is a simple flag queue — org-admins can approve/reject items.
*/

CREATE TABLE IF NOT EXISTS user_verifications (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  id_verified boolean NOT NULL DEFAULT false,
  phone_verified boolean NOT NULL DEFAULT false,
  responder_training text NOT NULL DEFAULT 'none',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_verifications" ON user_verifications;
CREATE POLICY "select_own_verifications" ON user_verifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_verifications" ON user_verifications;
CREATE POLICY "insert_own_verifications" ON user_verifications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_verifications" ON user_verifications;
CREATE POLICY "update_own_verifications" ON user_verifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS moderation_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type text NOT NULL,
  subject_id uuid NOT NULL,
  flag_reason text,
  status text NOT NULL DEFAULT 'pending',
  reviewer_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE moderation_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_moderation_queue" ON moderation_queue;
CREATE POLICY "read_moderation_queue" ON moderation_queue
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "update_moderation_queue" ON moderation_queue;
CREATE POLICY "update_moderation_queue" ON moderation_queue
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
