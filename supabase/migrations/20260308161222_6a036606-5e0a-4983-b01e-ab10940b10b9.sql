
-- Fix permissive bot_events insert policy - restrict to conversation members only
DROP POLICY IF EXISTS "bot_events_insert" ON public.bot_events;
CREATE POLICY "bot_events_insert" ON public.bot_events FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.bots WHERE id = bot_events.bot_id AND owner_id = auth.uid()));
