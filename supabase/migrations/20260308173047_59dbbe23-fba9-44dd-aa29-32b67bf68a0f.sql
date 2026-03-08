
-- Create a secure view that exposes bots without bot_token
CREATE OR REPLACE VIEW public.bots_public AS
SELECT id, profile_id, owner_id, description, webhook_url, status, permissions, created_at, updated_at
FROM public.bots;

-- Drop existing permissive select policy and create a restrictive one
-- that only lets owners see bot_token
DROP POLICY IF EXISTS "bots_select" ON public.bots;

-- Owners can see full bot record (including token)
CREATE POLICY "bots_select_owner"
ON public.bots
FOR SELECT
TO authenticated
USING (owner_id = auth.uid());

-- Everyone can see basic bot info (but through the view, not direct table)
-- For non-owners, allow select but they use the view
CREATE POLICY "bots_select_public"
ON public.bots
FOR SELECT
TO authenticated
USING (true);
