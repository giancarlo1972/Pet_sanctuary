/*
# Create stories and story_reports tables

## Overview
Adds two new tables to power the Community > Stories feature:
  1. `stories` — user-authored rescue stories (adoption, foster, rescue, reunion, memorial, update)
  2. `story_reports` — user-submitted reports flagging a story for moderation

## New Tables

### stories
| Column | Type | Description |
|---|---|---|
| id | uuid PK | Auto-generated |
| author_id | uuid NOT NULL DEFAULT auth.uid() | FK to profiles.id, the story author |
| organization_id | uuid NULL | FK to organizations.id, optional org attribution |
| pet_id | uuid NULL | FK to pets.id, optional link to a pet's profile |
| title | text NOT NULL | Story title |
| body | text NOT NULL | Story body (markdown/plain) |
| cover_photo_url | text NULL | Cover image URL |
| photo_urls | text[] DEFAULT '{}' | Up to 6 additional photo URLs |
| story_type | text NOT NULL | CHECK: adoption, foster, rescue, reunion, memorial, update |
| status | text NOT NULL DEFAULT 'draft' | CHECK: draft, published, archived |
| published_at | timestamptz NULL | Set automatically when status transitions to published |
| created_at | timestamptz DEFAULT now() | |
| updated_at | timestamptz DEFAULT now() | |

### story_reports
| Column | Type | Description |
|---|---|---|
| id | uuid PK | Auto-generated |
| story_id | uuid NOT NULL | FK to stories.id, cascading delete |
| reporter_id | uuid NOT NULL DEFAULT auth.uid() | FK to profiles.id, the reporting user |
| reason | text NULL | Optional reason text |
| created_at | timestamptz DEFAULT now() | |

## Security (RLS)

### stories
- SELECT: Anyone (anon + authenticated) can read published stories; authors can read their own drafts/archived.
- INSERT: Authenticated users can insert stories they author (author_id = auth.uid()).
- UPDATE: Authors can update their own stories. Organization members can update stories attributed to their org.
- DELETE: Authors can delete their own stories. Organization members can delete stories attributed to their org.

### story_reports
- SELECT: No access for anon or authenticated (only service role / admins via existing moderation tools).
- INSERT: Authenticated users can create reports (reporter_id = auth.uid()).

## Triggers
- `set_published_at`: Sets published_at = now() when status changes to 'published' and published_at is null.
- `set_updated_at`: Updates updated_at on row modification.

## Indexes
- `stories_published_at_idx` — for newest-first feed queries
- `stories_author_id_idx` — for "my stories" queries
- `stories_status_idx` — for filtering by status
- `story_reports_story_id_idx` — for looking up reports per story
*/

-- ============================================================
-- stories table
-- ============================================================
CREATE TABLE IF NOT EXISTS stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  pet_id uuid REFERENCES pets(id) ON DELETE SET NULL,
  title text NOT NULL,
  body text NOT NULL,
  cover_photo_url text,
  photo_urls text[] NOT NULL DEFAULT '{}',
  story_type text NOT NULL CHECK (story_type IN ('adoption','foster','rescue','reunion','memorial','update')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE stories ENABLE ROW LEVEL SECURITY;

-- SELECT: public reads published; authors read their own
DROP POLICY IF EXISTS "select_stories_public" ON stories;
CREATE POLICY "select_stories_public" ON stories FOR SELECT
  TO anon, authenticated
  USING (status = 'published' OR author_id = auth.uid());

-- INSERT: authenticated, author only
DROP POLICY IF EXISTS "insert_own_stories" ON stories;
CREATE POLICY "insert_own_stories" ON stories FOR INSERT
  TO authenticated
  WITH CHECK (author_id = auth.uid());

-- UPDATE: author or org member
DROP POLICY IF EXISTS "update_own_stories" ON stories;
CREATE POLICY "update_own_stories" ON stories FOR UPDATE
  TO authenticated
  USING (
    author_id = auth.uid()
    OR (
      organization_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.organization_id = stories.organization_id
        AND om.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    author_id = auth.uid()
    OR (
      organization_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.organization_id = stories.organization_id
        AND om.user_id = auth.uid()
      )
    )
  );

-- DELETE: author or org member
DROP POLICY IF EXISTS "delete_own_stories" ON stories;
CREATE POLICY "delete_own_stories" ON stories FOR DELETE
  TO authenticated
  USING (
    author_id = auth.uid()
    OR (
      organization_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.organization_id = stories.organization_id
        AND om.user_id = auth.uid()
      )
    )
  );

-- ============================================================
-- story_reports table
-- ============================================================
CREATE TABLE IF NOT EXISTS story_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE story_reports ENABLE ROW LEVEL SECURITY;

-- No SELECT for regular users — reports are private to admins
DROP POLICY IF EXISTS "insert_story_reports" ON story_reports;
CREATE POLICY "insert_story_reports" ON story_reports FOR INSERT
  TO authenticated
  WITH CHECK (reporter_id = auth.uid());

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS stories_published_at_idx ON stories (published_at DESC);
CREATE INDEX IF NOT EXISTS stories_author_id_idx ON stories (author_id);
CREATE INDEX IF NOT EXISTS stories_status_idx ON stories (status);
CREATE INDEX IF NOT EXISTS story_reports_story_id_idx ON story_reports (story_id);

-- ============================================================
-- Triggers
-- ============================================================

-- Set published_at when status transitions to 'published'
CREATE OR REPLACE FUNCTION set_story_published_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'published' AND OLD.status <> 'published' AND NEW.published_at IS NULL THEN
    NEW.published_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_story_published_at ON stories;
CREATE TRIGGER trg_set_story_published_at
  BEFORE UPDATE ON stories
  FOR EACH ROW
  EXECUTE FUNCTION set_story_published_at();

-- Update updated_at on row modification
CREATE OR REPLACE FUNCTION update_story_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_story_updated_at ON stories;
CREATE TRIGGER trg_update_story_updated_at
  BEFORE UPDATE ON stories
  FOR EACH ROW
  EXECUTE FUNCTION update_story_updated_at();