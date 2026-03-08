
-- Fix: Allow creators to also SELECT their own conversations
DROP POLICY IF EXISTS "conversations_select" ON public.conversations;
CREATE POLICY "conversations_select" ON public.conversations
FOR SELECT TO authenticated
USING (
  created_by = auth.uid()
  OR public.is_conversation_member(auth.uid(), id)
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
);
