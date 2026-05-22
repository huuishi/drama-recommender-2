-- Run this once in the Supabase SQL Editor if your favorites table already exists.
-- It allows users to save the same drama to the same collection after confirming in the UI.
ALTER TABLE public.favorites
  DROP CONSTRAINT IF EXISTS favorites_user_id_collection_name_drama_title_key;
