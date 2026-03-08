
-- Inline queries table
CREATE TABLE public.inline_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  query_text text NOT NULL DEFAULT '',
  chat_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inline_queries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inline_queries_select" ON public.inline_queries FOR SELECT USING (true);
CREATE POLICY "inline_queries_insert" ON public.inline_queries FOR INSERT WITH CHECK (true);

-- Inline results table (cached results from bots)
CREATE TABLE public.inline_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  result_id text NOT NULL,
  result_type text NOT NULL DEFAULT 'article',
  title text NOT NULL,
  description text,
  content text,
  thumbnail_url text,
  reply_markup jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '1 hour')
);

ALTER TABLE public.inline_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inline_results_select" ON public.inline_results FOR SELECT USING (true);
CREATE POLICY "inline_results_insert" ON public.inline_results FOR INSERT WITH CHECK (true);
CREATE POLICY "inline_results_delete" ON public.inline_results FOR DELETE USING (true);

CREATE INDEX inline_results_bot_id_idx ON public.inline_results (bot_id);
CREATE INDEX inline_queries_bot_id_idx ON public.inline_queries (bot_id);
