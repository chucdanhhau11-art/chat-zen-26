
-- Add is_bot flag to profiles
ALTER TABLE public.profiles ADD COLUMN is_bot boolean NOT NULL DEFAULT false;

-- Create bot status enum
CREATE TYPE public.bot_status AS ENUM ('active', 'disabled');

-- Create bots table
CREATE TABLE public.bots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  owner_id uuid NOT NULL,
  bot_token text NOT NULL UNIQUE,
  webhook_url text,
  description text,
  status public.bot_status NOT NULL DEFAULT 'active',
  permissions jsonb NOT NULL DEFAULT '{"read_messages":true,"send_messages":true,"delete_messages":false,"manage_users":false}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create bot_commands table
CREATE TABLE public.bot_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  command text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(bot_id, command)
);

-- Create bot_events table for webhook queue
CREATE TABLE public.bot_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_events ENABLE ROW LEVEL SECURITY;

-- RLS for bots: everyone can see, only owner can manage
CREATE POLICY "bots_select" ON public.bots FOR SELECT TO authenticated USING (true);
CREATE POLICY "bots_insert" ON public.bots FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "bots_update" ON public.bots FOR UPDATE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "bots_delete" ON public.bots FOR DELETE TO authenticated USING (owner_id = auth.uid());

-- RLS for bot_commands: everyone can see, owner can manage
CREATE POLICY "bot_commands_select" ON public.bot_commands FOR SELECT TO authenticated USING (true);
CREATE POLICY "bot_commands_insert" ON public.bot_commands FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.bots WHERE id = bot_commands.bot_id AND owner_id = auth.uid()));
CREATE POLICY "bot_commands_update" ON public.bot_commands FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bots WHERE id = bot_commands.bot_id AND owner_id = auth.uid()));
CREATE POLICY "bot_commands_delete" ON public.bot_commands FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bots WHERE id = bot_commands.bot_id AND owner_id = auth.uid()));

-- RLS for bot_events: only bot owner can see
CREATE POLICY "bot_events_select" ON public.bot_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bots WHERE id = bot_events.bot_id AND owner_id = auth.uid()));
CREATE POLICY "bot_events_insert" ON public.bot_events FOR INSERT TO authenticated WITH CHECK (true);

-- Enable realtime for bot_events
ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_events;

-- Update trigger for bots
CREATE TRIGGER update_bots_updated_at BEFORE UPDATE ON public.bots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
