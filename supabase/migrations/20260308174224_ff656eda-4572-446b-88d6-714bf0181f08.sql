
CREATE TABLE public.botfather_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  state text NOT NULL DEFAULT 'idle',
  data jsonb DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.botfather_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own session"
ON public.botfather_sessions
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
