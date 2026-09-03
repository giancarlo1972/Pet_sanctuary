-- Add unique constraint on document_id so upserts work correctly
ALTER TABLE document_extractions
  ADD CONSTRAINT document_extractions_document_id_unique UNIQUE (document_id);