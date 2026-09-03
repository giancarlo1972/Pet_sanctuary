export type StoryType = 'adoption' | 'foster' | 'rescue' | 'reunion' | 'memorial' | 'update';

export interface Story {
  id: string;
  author_id: string;
  organization_id: string | null;
  pet_id: string | null;
  title: string;
  body: string;
  cover_photo_url: string | null;
  photo_urls: string[];
  story_type: StoryType;
  status: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  author_name: string | null;
  author_avatar: string | null;
  org_name: string | null;
  org_logo: string | null;
  pet_name: string | null;
  pet_photo: string | null;
}
