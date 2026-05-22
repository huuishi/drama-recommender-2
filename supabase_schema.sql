-- Create a table for user favorites
CREATE TABLE public.favorites (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  drama_title text NOT NULL,
  synopsis text,
  image_url text,
  collection_name text DEFAULT 'My Collections' NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- Create policies so users can only manage their own favorites
CREATE POLICY "Users can view own favorites."
  ON favorites FOR SELECT
  USING ( auth.uid() = user_id );

CREATE POLICY "Users can insert own favorites."
  ON favorites FOR INSERT
  WITH CHECK ( auth.uid() = user_id );

CREATE POLICY "Users can delete own favorites."
  ON favorites FOR DELETE
  USING ( auth.uid() = user_id );


-- If your table was created before duplicates were allowed, run this once in Supabase SQL Editor.
-- It removes the old rule that blocked saving the same drama to the same collection twice.
ALTER TABLE public.favorites
  DROP CONSTRAINT IF EXISTS favorites_user_id_collection_name_drama_title_key;
