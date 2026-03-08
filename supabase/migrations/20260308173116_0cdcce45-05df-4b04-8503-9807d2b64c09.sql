
-- Fix the security definer view issue
DROP VIEW IF EXISTS public.bots_public;
CREATE VIEW public.bots_public 
WITH (security_invoker = true) AS
SELECT id, profile_id, owner_id, description, webhook_url, status, permissions, created_at, updated_at
FROM public.bots;

-- Remove the redundant duplicate policy (bots_select_public duplicates bots_select_owner)
DROP POLICY IF EXISTS "bots_select_public" ON public.bots;

-- Re-add a simple public select (needed for bot lookup by profile_id)
CREATE POLICY "bots_select_all"
ON public.bots
FOR SELECT
TO authenticated
USING (true);
