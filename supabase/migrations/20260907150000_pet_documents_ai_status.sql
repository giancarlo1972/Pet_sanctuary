ALTER TABLE pet_documents ADD COLUMN IF NOT EXISTS ai_status text;
ALTER TABLE pet_documents ADD COLUMN IF NOT EXISTS ai_summary jsonb;
ALTER TABLE pet_documents ADD COLUMN IF NOT EXISTS file_path text;
ALTER TABLE pet_documents ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE pet_documents ADD COLUMN IF NOT EXISTS clinic text;
ALTER TABLE pet_documents ADD COLUMN IF NOT EXISTS taken_on date;
ALTER TABLE pet_documents ADD COLUMN IF NOT EXISTS notes text;
