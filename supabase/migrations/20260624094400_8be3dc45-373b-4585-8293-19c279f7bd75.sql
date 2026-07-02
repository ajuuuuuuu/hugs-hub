
DROP POLICY IF EXISTS "Anyone can submit suggestions" ON public.suggestions;
CREATE POLICY "Anyone can submit suggestions"
  ON public.suggestions FOR INSERT
  TO anon, authenticated
  WITH CHECK (char_length(trim(message)) > 0 AND char_length(message) <= 2000);
