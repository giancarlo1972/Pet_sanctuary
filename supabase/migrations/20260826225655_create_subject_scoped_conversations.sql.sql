/*
# Subject-scoped conversations and messaging

## Summary

Replaces the mock chat with a real, subject-scoped messaging system. Conversations
are tied to a specific subject (a report, a pet, or an adoption application), so
tapping "Message" always opens the correct thread — never an unrelated one.

## New Tables

1. **conversations** — subject_type ('report'|'pet'|'application'|'direct'), subject_id,
   created_by, created_at, last_message_at
2. **conversation_participants** — (conversation_id, user_id) PK, organization_id nullable,
   last_read_at
3. **messages** — conversation_id, sender_id, body, attachment_url, created_at
4. **conversation_blocks** — blocker_id, blocked_id, conversation_id, unique constraint
5. **conversation_reports** — reporter_id, conversation_id, reason

## RLS

- conversations: SELECT/UPDATE only for participants. INSERT by creator.
- conversation_participants: SELECT own rows only. INSERT/UPDATE via RPC only.
- messages: SELECT for participants. INSERT by participant+sender, blocked users excluded.
- conversation_blocks: INSERT/SELECT by blocker.
- conversation_reports: INSERT/SELECT by reporter.

## RPC: get_or_create_conversation(p_subject_type, p_subject_id)

Returns existing conversation UUID for this subject + current user, or creates one
with correct participants:
- report → reporter + current user
- pet → shelter staff + current user
- application → applicant + shelter staff + current user
- direct → just current user

SECURITY DEFINER, EXECUTE revoked from anon.

## Trigger

update_conversation_last_message_at — fires on messages INSERT, updates
conversations.last_message_at.

## Notes

1. No existing messages to migrate — old chat was entirely mock.
2. Blocked users cannot send messages (checked in INSERT policy).
3. Org members who are not participants cannot read conversations.
*/

-- ============================================================================
-- Create all tables first (no policies yet)
-- ============================================================================

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type text NOT NULL CHECK (subject_type IN ('report', 'pet', 'application', 'direct')),
  subject_id uuid,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz
);

CREATE TABLE IF NOT EXISTS conversation_participants (
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  organization_id uuid,
  last_read_at timestamptz,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL DEFAULT auth.uid(),
  body text NOT NULL,
  attachment_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages (conversation_id, created_at);

CREATE TABLE IF NOT EXISTS conversation_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL DEFAULT auth.uid(),
  blocked_id uuid NOT NULL,
  conversation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id, conversation_id)
);

CREATE TABLE IF NOT EXISTS conversation_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL DEFAULT auth.uid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- Enable RLS on all tables
-- ============================================================================

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_reports ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies: conversations
-- ============================================================================

DROP POLICY IF EXISTS "conv_select_participant" ON conversations;
CREATE POLICY "conv_select_participant"
ON conversations FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM conversation_participants cp
    WHERE cp.conversation_id = conversations.id AND cp.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "conv_insert_creator" ON conversations;
CREATE POLICY "conv_insert_creator"
ON conversations FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "conv_update_participant" ON conversations;
CREATE POLICY "conv_update_participant"
ON conversations FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM conversation_participants cp
    WHERE cp.conversation_id = conversations.id AND cp.user_id = auth.uid()
  )
);

-- ============================================================================
-- RLS Policies: conversation_participants
-- ============================================================================

DROP POLICY IF EXISTS "cp_select_participant" ON conversation_participants;
CREATE POLICY "cp_select_participant"
ON conversation_participants FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- ============================================================================
-- RLS Policies: messages
-- ============================================================================

DROP POLICY IF EXISTS "msg_select_participant" ON messages;
CREATE POLICY "msg_select_participant"
ON messages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM conversation_participants cp
    WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "msg_insert_participant" ON messages;
CREATE POLICY "msg_insert_participant"
ON messages FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM conversation_participants cp
    WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = auth.uid()
  )
  AND NOT EXISTS (
    SELECT 1 FROM conversation_blocks cb
    WHERE cb.blocked_id = auth.uid()
      AND cb.blocker_id <> auth.uid()
      AND (cb.conversation_id = messages.conversation_id OR cb.conversation_id IS NULL)
  )
);

DROP POLICY IF EXISTS "msg_delete_sender" ON messages;
CREATE POLICY "msg_delete_sender"
ON messages FOR DELETE
TO authenticated
USING (sender_id = auth.uid());

-- ============================================================================
-- RLS Policies: conversation_blocks
-- ============================================================================

DROP POLICY IF EXISTS "block_insert_own" ON conversation_blocks;
CREATE POLICY "block_insert_own"
ON conversation_blocks FOR INSERT
TO authenticated
WITH CHECK (blocker_id = auth.uid());

DROP POLICY IF EXISTS "block_select_own" ON conversation_blocks;
CREATE POLICY "block_select_own"
ON conversation_blocks FOR SELECT
TO authenticated
USING (blocker_id = auth.uid());

-- ============================================================================
-- RLS Policies: conversation_reports
-- ============================================================================

DROP POLICY IF EXISTS "report_insert_own" ON conversation_reports;
CREATE POLICY "report_insert_own"
ON conversation_reports FOR INSERT
TO authenticated
WITH CHECK (reporter_id = auth.uid());

DROP POLICY IF EXISTS "report_select_own" ON conversation_reports;
CREATE POLICY "report_select_own"
ON conversation_reports FOR SELECT
TO authenticated
USING (reporter_id = auth.uid());

-- ============================================================================
-- Trigger: update conversations.last_message_at on new message
-- ============================================================================

CREATE OR REPLACE FUNCTION update_conversation_last_message_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE conversations SET last_message_at = now() WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_last_message_at ON messages;
CREATE TRIGGER trg_update_last_message_at
AFTER INSERT ON messages
FOR EACH ROW EXECUTE FUNCTION update_conversation_last_message_at();

-- ============================================================================
-- RPC: get_or_create_conversation
-- ============================================================================

CREATE OR REPLACE FUNCTION get_or_create_conversation(
  p_subject_type text,
  p_subject_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_conv_id uuid;
  v_reporter_id uuid;
  v_shelter_id uuid;
  v_applicant_id uuid;
  v_current uuid := auth.uid();
BEGIN
  IF v_current IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_subject_type NOT IN ('report', 'pet', 'application', 'direct') THEN
    RAISE EXCEPTION 'Invalid subject type';
  END IF;

  -- Look for existing conversation where current user is a participant
  SELECT c.id INTO v_conv_id
  FROM conversations c
  JOIN conversation_participants cp ON cp.conversation_id = c.id
  WHERE c.subject_type = p_subject_type
    AND (p_subject_id IS NULL OR c.subject_id = p_subject_id)
    AND cp.user_id = v_current
  LIMIT 1;

  IF v_conv_id IS NOT NULL THEN
    RETURN v_conv_id;
  END IF;

  -- Create new conversation
  INSERT INTO conversations (subject_type, subject_id, created_by)
  VALUES (p_subject_type, p_subject_id, v_current)
  RETURNING id INTO v_conv_id;

  -- Add current user as participant
  INSERT INTO conversation_participants (conversation_id, user_id)
  VALUES (v_conv_id, v_current);

  -- Add other participants based on subject type
  IF p_subject_type = 'report' AND p_subject_id IS NOT NULL THEN
    SELECT user_id INTO v_reporter_id FROM reports WHERE id = p_subject_id;
    IF v_reporter_id IS NOT NULL AND v_reporter_id <> v_current THEN
      INSERT INTO conversation_participants (conversation_id, user_id)
      VALUES (v_conv_id, v_reporter_id)
      ON CONFLICT DO NOTHING;
    END IF;

  ELSIF p_subject_type = 'pet' AND p_subject_id IS NOT NULL THEN
    SELECT shelter_id INTO v_shelter_id FROM pets WHERE id = p_subject_id;
    IF v_shelter_id IS NOT NULL THEN
      INSERT INTO conversation_participants (conversation_id, user_id, organization_id)
      SELECT v_conv_id, sm.user_id, sm.shelter_id
      FROM shelter_members sm
      WHERE sm.shelter_id = v_shelter_id
        AND sm.user_id <> v_current
      ON CONFLICT DO NOTHING;

      INSERT INTO conversation_participants (conversation_id, user_id, organization_id)
      SELECT v_conv_id, om.user_id, om.organization_id
      FROM organization_members om
      WHERE om.organization_id = v_shelter_id
        AND om.user_id <> v_current
      ON CONFLICT DO NOTHING;
    END IF;

    INSERT INTO conversation_participants (conversation_id, user_id)
    SELECT v_conv_id, p.owner_id
    FROM pets p
    WHERE p.id = p_subject_id
      AND p.owner_id IS NOT NULL
      AND p.owner_id <> v_current
    ON CONFLICT DO NOTHING;

  ELSIF p_subject_type = 'application' AND p_subject_id IS NOT NULL THEN
    SELECT user_id INTO v_applicant_id FROM adoption_applications WHERE id = p_subject_id;
    IF v_applicant_id IS NOT NULL AND v_applicant_id <> v_current THEN
      INSERT INTO conversation_participants (conversation_id, user_id)
      VALUES (v_conv_id, v_applicant_id)
      ON CONFLICT DO NOTHING;
    END IF;

    SELECT p.shelter_id INTO v_shelter_id
    FROM adoption_applications a
    JOIN pets p ON p.id = a.pet_id
    WHERE a.id = p_subject_id;

    IF v_shelter_id IS NOT NULL THEN
      INSERT INTO conversation_participants (conversation_id, user_id, organization_id)
      SELECT v_conv_id, sm.user_id, sm.shelter_id
      FROM shelter_members sm
      WHERE sm.shelter_id = v_shelter_id
        AND sm.user_id <> v_current
      ON CONFLICT DO NOTHING;

      INSERT INTO conversation_participants (conversation_id, user_id, organization_id)
      SELECT v_conv_id, om.user_id, om.organization_id
      FROM organization_members om
      WHERE om.organization_id = v_shelter_id
        AND om.user_id <> v_current
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN v_conv_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION get_or_create_conversation(text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION get_or_create_conversation(text, uuid) TO authenticated;
